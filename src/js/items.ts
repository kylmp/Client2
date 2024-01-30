import 'style/mesanim.scss';

import SeqType from './jagex2/config/SeqType';
import LocType from './jagex2/config/LocType';
import FloType from './jagex2/config/FloType';
import ObjType from './jagex2/config/ObjType';
import NpcType from './jagex2/config/NpcType';
import IdkType from './jagex2/config/IdkType';
import SpotAnimType from './jagex2/config/SpotAnimType';
import VarpType from './jagex2/config/VarpType';
import ComType from './jagex2/config/ComType';
import MesAnimType from './jagex2/config/MesAnimType';

import Draw2D from './jagex2/graphics/Draw2D';
import Draw3D from './jagex2/graphics/Draw3D';
import PixFont from './jagex2/graphics/PixFont';
import Model from './jagex2/graphics/Model';
import SeqBase from './jagex2/graphics/SeqBase';
import SeqFrame from './jagex2/graphics/SeqFrame';

import Jagfile from './jagex2/io/Jagfile';

import WordFilter from './jagex2/wordenc/WordFilter';
import {downloadText, downloadUrl, sleep} from './jagex2/util/JsUtil';
import GameShell from './jagex2/client/GameShell';
import Packet from './jagex2/io/Packet';
import Wave from './jagex2/sound/Wave';
import Database from './jagex2/io/Database';
import {canvas, canvas2d} from './jagex2/graphics/Canvas';
import Pix8 from './jagex2/graphics/Pix8';
import Bzip from './vendor/bzip';
import Pix24 from './jagex2/graphics/Pix24';

class Viewer extends GameShell {
    static HOST: string = 'https://w2.225.2004scape.org';
    static REPO: string = 'https://raw.githubusercontent.com/2004scape/Server/main';
    static readonly CHARSET: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!"£$%^&*()-_=+[{]};:\'@#~,<.>/?\\| ';

    private db: Database | null = null;

    alreadyStarted: boolean = false;
    errorStarted: boolean = false;
    errorLoading: boolean = false;
    errorHost: boolean = false;

    ingame: boolean = false;
    archiveChecksums: number[] = [];

    fontPlain11: PixFont | null = null;
    fontPlain12: PixFont | null = null;
    fontBold12: PixFont | null = null;
    fontQuill8: PixFont | null = null;

    // id -> name for cache files
    packfiles: Map<number, string>[] = [];

    async loadPack(url: string): Promise<Map<number, string>> {
        const map: Map<number, string> = new Map();

        const pack: string = await downloadText(url);
        const lines: string[] = pack.split('\n');
        for (let i: number = 0; i < lines.length; i++) {
            const line: string = lines[i];
            const idx: number = line.indexOf('=');
            if (idx === -1) {
                continue;
            }

            const id: number = parseInt(line.substring(0, idx));
            const name: string = line.substring(idx + 1);
            map.set(id, name);
        }

        return map;
    }

    load = async (): Promise<void> => {
        if (this.alreadyStarted) {
            this.errorStarted = true;
            return;
        }

        this.alreadyStarted = true;

        try {
            await this.showProgress(10, 'Connecting to fileserver');

            await Bzip.load(await (await fetch('bz2.wasm')).arrayBuffer());
            this.db = new Database(await Database.openDatabase());

            const checksums: Packet = new Packet(new Uint8Array(await downloadUrl(`${Viewer.HOST}/crc`)));
            for (let i: number = 0; i < 9; i++) {
                this.archiveChecksums[i] = checksums.g4;
            }

            const title: Jagfile = await this.loadArchive('title', 'title screen', this.archiveChecksums[1], 10);

            this.fontPlain11 = PixFont.fromArchive(title, 'p11');
            this.fontPlain12 = PixFont.fromArchive(title, 'p12');
            this.fontBold12 = PixFont.fromArchive(title, 'b12');
            this.fontQuill8 = PixFont.fromArchive(title, 'q8');

            const config: Jagfile = await this.loadArchive('config', 'config', this.archiveChecksums[2], 15);
            const models: Jagfile = await this.loadArchive('models', '3d graphics', this.archiveChecksums[5], 40);
            const textures: Jagfile = await this.loadArchive('textures', 'textures', this.archiveChecksums[6], 60);

            await this.showProgress(80, 'Unpacking textures');
            Draw3D.unpackTextures(textures);
            Draw3D.setBrightness(0.8);
            Draw3D.initPool(20);

            await this.showProgress(83, 'Unpacking models');
            Model.unpack(models);
            SeqBase.unpack(models);
            SeqFrame.unpack(models);

            await this.showProgress(86, 'Unpacking config');
            SeqType.unpack(config);
            ObjType.unpack(config, true);

            await this.showProgress(95, 'Generating item sprites');
            await this.populateItems();

            await this.showProgress(100, 'Getting ready to start...');
        } catch (err) {
            this.errorLoading = true;
            console.error(err);
        }
    };

    update = async (): Promise<void> => {
        if (this.errorStarted || this.errorLoading || this.errorHost) {
            return;
        }
    };

    draw = async (): Promise<void> => {
        if (this.errorStarted || this.errorLoading || this.errorHost) {
            this.drawErrorScreen();
            return;
        }
    };

    //

    showProgress = async (progress: number, str: string): Promise<void> => {
        console.log(`${progress}%: ${str}`);

        await super.showProgress(progress, str);
    };

    async loadArchive(filename: string, displayName: string, crc: number, progress: number): Promise<Jagfile> {
        let retry: number = 5;
        let data: Int8Array | undefined = await this.db?.cacheload(filename);
        if (data) {
            if (Packet.crc32(data) !== crc) {
                data = undefined;
            }
        }

        if (data) {
            return new Jagfile(data);
        }

        while (!data) {
            await this.showProgress(progress, `Requesting ${displayName}`);

            try {
                data = await downloadUrl(`${Viewer.HOST}/${filename}${crc}`);
            } catch (e) {
                data = undefined;
                for (let i: number = retry; i > 0; i--) {
                    await this.showProgress(progress, `Error loading - Will retry in ${i} secs.`);
                    await sleep(1000);
                }
                retry *= 2;
                if (retry > 60) {
                    retry = 60;
                }
            }
        }
        await this.db?.cachesave(filename, data);
        return new Jagfile(data);
    }

    drawErrorScreen(): void {
        canvas2d.fillStyle = 'black';
        canvas2d.fillRect(0, 0, this.width, this.height);

        this.setFramerate(1);

        if (this.errorLoading) {
            canvas2d.font = 'bold 16px helvetica, sans-serif';
            canvas2d.textAlign = 'left';
            canvas2d.fillStyle = 'yellow';

            let y: number = 35;
            canvas2d.fillText('Sorry, an error has occured whilst loading RuneScape', 30, y);

            y += 50;
            canvas2d.fillStyle = 'white';
            canvas2d.fillText('To fix this try the following (in order):', 30, y);

            y += 50;
            canvas2d.font = 'bold 12px helvetica, sans-serif';
            canvas2d.fillText('1: Try closing ALL open web-browser windows, and reloading', 30, y);

            y += 30;
            canvas2d.fillText('2: Try clearing your web-browsers cache from tools->internet options', 30, y);

            y += 30;
            canvas2d.fillText('3: Try using a different game-world', 30, y);

            y += 30;
            canvas2d.fillText('4: Try rebooting your computer', 30, y);

            y += 30;
            canvas2d.fillText('5: Try selecting a different version of Java from the play-game menu', 30, y);
        }

        if (this.errorHost) {
            canvas2d.font = 'bold 20px helvetica, sans-serif';
            canvas2d.textAlign = 'left';
            canvas2d.fillStyle = 'white';

            canvas2d.fillText('Error - unable to load game!', 50, 50);
            canvas2d.fillText('To play RuneScape make sure you play from', 50, 100);
            canvas2d.fillText('https://2004scape.org', 50, 150);
        }

        if (this.errorStarted) {
            canvas2d.font = 'bold 13px helvetica, sans-serif';
            canvas2d.textAlign = 'left';
            canvas2d.fillStyle = 'yellow';

            let y: number = 35;
            canvas2d.fillText('Error a copy of RuneScape already appears to be loaded', 30, y);

            y += 50;
            canvas2d.fillStyle = 'white';
            canvas2d.fillText('To fix this try the following (in order):', 30, y);

            y += 50;
            canvas2d.font = 'bold 12px helvetica, sans-serif';
            canvas2d.fillText('1: Try closing ALL open web-browser windows, and reloading', 30, y);

            y += 30;
            canvas2d.fillText('2: Try rebooting your computer, and reloading', 30, y);
        }
    }

    //

    async populateItems(): Promise<void> {
        const items: HTMLElement | null = document.getElementById('items');
        if (!items) {
            return;
        }

        this.packfiles[1] = await this.loadPack(`${Viewer.REPO}/data/pack/obj.pack`);

        const search: HTMLInputElement = document.createElement('input');
        search.type = 'search';
        search.placeholder = 'Search';
        search.tabIndex = 1;
        search.oninput = (): void => {
            const ul: HTMLUListElement | null = document.querySelector('#itemList');
            if (!ul) {
                return;
            }

            const filter: string = search.value.toLowerCase().replaceAll(' ', '_');

            for (let i: number = 0; i < ul.children.length; i++) {
                const child: HTMLElement = ul.children[i] as HTMLElement;

                const rsId: string = child.getAttribute('rs-id') ?? child.id;
                const rsDebugName: string = child.getAttribute('rs-debugname') ?? child.id;
                const rsName: string = child.getAttribute('rs-name') ?? child.id;

                if (child.id.indexOf(filter) > -1 || rsId.indexOf(filter) > -1 || rsDebugName.indexOf(filter) > -1 || rsName.indexOf(filter) > -1) {
                    child.style.display = '';
                } else {
                    child.style.display = 'none';
                }
            }
        };
        items.appendChild(search);

        const ul: HTMLUListElement = document.createElement('ul');
        ul.id = 'itemList';
        ul.className = 'list-group';
        items.appendChild(ul);

        for (const [id, name] of this.packfiles[1]) {
            const type: ObjType = ObjType.get(id);

            const li: HTMLLIElement = document.createElement('li');
            li.id = name;
            li.setAttribute('rs-id', id.toString());
            li.setAttribute('rs-debugname', name);
            li.setAttribute('rs-name', type.name?.toLowerCase().replaceAll(' ', '_') ?? name);
            li.className = 'list-group-item';
            if (id === 0) {
                li.className += ' active';
            }
            if (type.name === null) {
                li.innerText = name + ' (' + id + ')';
            } else {
                li.innerText = type.name + ' - ' + name + ' (' + id + ')';
            }
            li.onclick = (): void => {
                const last: Element | null = ul.querySelector('.active');
                if (last) {
                    last.className = 'list-group-item';
                }

                li.className = 'list-group-item active';
            };

            // const icon = ObjType.getIcon(id, 1);
            // icon.draw(0, 0);

            // const canvas: HTMLCanvasElement = document.createElement('canvas');
            // canvas.width = icon.width;
            // canvas.height = icon.height;
            // const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d', { willReadFrequently: true });
            // if (ctx) {
            //     const image = ctx.getImageData(0, 0, icon.width, icon.height);
            //     const data: Uint8ClampedArray = image.data;
            //     for (let i: number = 0; i < icon.pixels.length; i++) {
            //         const pixel: number = icon.pixels[i];
            //         const index: number = i * 4;
            //         data[index] = 255; // (pixel >> 16) & 0xff;
            //         data[index + 1] = 0; // (pixel >> 8) & 0xff;
            //         data[index + 2] = 0; // (pixel >> 0) & 0xff;
            //         data[index + 3] = 255;
            //     }
            //     ctx.putImageData(image, icon.width, icon.height);
            // }
            // li.appendChild(canvas);

            ul.appendChild(li);
        }
    }
}

new Viewer().run().then((): void => {});

// prevent space from scrolling page
window.onkeydown = function (e): boolean {
    return !(e.key === ' ' && e.target === document.body);
};
