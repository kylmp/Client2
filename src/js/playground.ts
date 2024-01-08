import GameShell from './jagex2/client/GameShell.js';

import SeqType from './jagex2/config/SeqType.js';
import LocType from './jagex2/config/LocType.js';
import FloType from './jagex2/config/FloType.js';
import ObjType from './jagex2/config/ObjType.js';
import NpcType from './jagex2/config/NpcType.js';
import IdkType from './jagex2/config/IdkType.js';
import SpotAnimType from './jagex2/config/SpotAnimType.js';
import VarpType from './jagex2/config/VarpType.js';
import ComType from './jagex2/config/ComType.js';

import Draw3D from './jagex2/graphics/Draw3D.js';
import PixFont from './jagex2/graphics/PixFont.js';
import Model from './jagex2/graphics/Model.js';
import SeqBase from './jagex2/graphics/SeqBase.js';
import SeqFrame from './jagex2/graphics/SeqFrame.js';

import Jagfile from './jagex2/io/Jagfile.js';

import WordFilter from './jagex2/wordenc/WordFilter.js';
import {downloadUrl} from './jagex2/util/JsUtil.js';
import Draw2D from './jagex2/graphics/Draw2D.js';
import Packet from './jagex2/io/Packet.js';
import Wave from './jagex2/sound/Wave';

class Playground extends GameShell {
    static HOST = 'https://w2.225.2004scape.org';

    private fontPlain11: PixFont | null = null;
    private fontPlain12: PixFont | null = null;
    private fontBold12: PixFont | null = null;
    private fontQuill8: PixFont | null = null;

    lastHistoryRefresh = 0;
    historyRefresh = true;

    constructor() {
        super(true);
    }

    load = async () => {
        await this.showProgress(10, 'Connecting to fileserver');

        const checksums = new Packet(await downloadUrl(`${Playground.HOST}/crc`));
        const archiveChecksums = [];
        for (let i = 0; i < 9; i++) {
            archiveChecksums[i] = checksums.g4;
        }

        const title = await this.loadArchive('title', 'title screen', archiveChecksums[1], 10);

        this.fontPlain11 = PixFont.fromArchive(title, 'p11');
        this.fontPlain12 = PixFont.fromArchive(title, 'p12');
        this.fontBold12 = PixFont.fromArchive(title, 'b12');
        this.fontQuill8 = PixFont.fromArchive(title, 'q8');

        const config = await this.loadArchive('config', 'config', archiveChecksums[2], 15);
        const interfaces = await this.loadArchive('interface', 'interface', archiveChecksums[3], 20);
        const media = await this.loadArchive('media', '2d graphics', archiveChecksums[4], 30);
        const models = await this.loadArchive('models', '3d graphics', archiveChecksums[5], 40);
        const textures = await this.loadArchive('textures', 'textures', archiveChecksums[6], 60);
        const wordenc = await this.loadArchive('wordenc', 'chat system', archiveChecksums[7], 65);
        const sounds = await this.loadArchive('sounds', 'sound effects', archiveChecksums[8], 70);

        await this.showProgress(75, 'Unpacking media');

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
        LocType.unpack(config);
        FloType.unpack(config);
        ObjType.unpack(config, true);
        NpcType.unpack(config);
        IdkType.unpack(config);
        SpotAnimType.unpack(config);
        VarpType.unpack(config);

        await this.showProgress(90, 'Unpacking sounds');
        Wave.unpack(sounds);

        await this.showProgress(92, 'Unpacking interfaces');
        ComType.unpack(interfaces, media, [this.fontPlain11, this.fontPlain12, this.fontBold12, this.fontQuill8]);

        await this.showProgress(97, 'Preparing game engine');
        WordFilter.unpack(wordenc);

        // this.setLoopRate(1);
        this.drawArea?.bind();
        Draw3D.init2D();
    };

    update = async (): Promise<void> => {
        this.updateKeysPressed();
        this.updateKeysHeld();

        this.lastHistoryRefresh++;

        if (this.lastHistoryRefresh > 50) {
            if (this.historyRefresh) {
                GameShell.setParameter('model', this.model.id.toString());
                GameShell.setParameter('x', this.model.pitch.toString());
                GameShell.setParameter('y', this.model.yaw.toString());
                GameShell.setParameter('z', this.model.roll.toString());
                GameShell.setParameter('eyeX', this.camera.x.toString());
                GameShell.setParameter('eyeY', this.camera.y.toString());
                GameShell.setParameter('eyeZ', this.camera.z.toString());
                GameShell.setParameter('eyePitch', this.camera.pitch.toString());

                this.historyRefresh = false;
            }

            this.lastHistoryRefresh = 0;
        }
    };

    draw = async () => {
        Draw2D.clear();
        Draw2D.fillRect(0, 0, this.width, this.height, 0x555555);

        /// draw all textures
        // let x = 0;
        // let y = 0;
        // for (let i = 0; i < Draw3D.textureCount; i++) {
        //     if (x > this.width) {
        //         x = 0;
        //         y += 128;
        //     }

        //     Draw3D.textures[i].draw(x, y);
        //     x += 128;
        // }

        /// draw all flotypes
        // let x = 0;
        // let y = this.b12.fontHeight;
        // for (let i = 0; i < FloType.count; i++) {
        //     let flo = FloType.get(i);
        //     this.b12.draw(x, y, `${i}: ${flo.name}`, 0xFFFF00);

        //     let textSize = this.b12.getTextWidth(`${i}: ${flo.name}`);

        //     if (flo.texture != -1) {
        //         Draw3D.textures[flo.texture].draw(x + textSize, y - this.b12.fontHeight + 1, this.b12.fontHeight, this.b12.fontHeight);
        //     } else {
        //         Draw2D.fillRect(x + textSize, y - this.b12.fontHeight + 1, this.b12.fontHeight, this.b12.fontHeight, flo.rgb);
        //     }

        //     y += this.b12.fontHeight;
        //     if (y > this.height) {
        //         x += 200;
        //         y = this.b12.fontHeight;
        //     }
        // }

        // draw a model
        const model = new Model(this.model.id);
        model.calculateNormals(64, 850, -30, -50, -30, true);
        model.drawSimple(this.model.pitch, this.model.yaw, this.model.roll, this.camera.pitch, this.camera.x, this.camera.y, this.camera.z);

        // debug
        if (this.fontBold12) {
            this.fontBold12.drawRight(this.width, this.fontBold12.fontHeight, `FPS: ${this.fps}`, 0xffff00);
            this.fontBold12.drawRight(this.width, this.height, `${this.model.pitch},${this.model.yaw},${this.model.roll},${this.camera.pitch},${this.camera.x},${this.camera.z},${this.camera.y}`, 0xffff00);

            // controls
            let leftY = this.fontBold12.fontHeight;
            this.fontBold12.draw(0, leftY, `Model: ${this.model.id}`, 0xffff00);
            leftY += this.fontBold12.fontHeight;
            this.fontBold12.draw(0, leftY, 'Controls:', 0xffff00);
            leftY += this.fontBold12.fontHeight;
            this.fontBold12.draw(0, leftY, 'r - reset camera and model rotation + movement speed', 0xffff00);
            leftY += this.fontBold12.fontHeight;
            this.fontBold12.draw(0, leftY, '1 and 2 - change model', 0xffff00);
            leftY += this.fontBold12.fontHeight;
            this.fontBold12.draw(0, leftY, '[ and ] - adjust movement speed', 0xffff00);
            leftY += this.fontBold12.fontHeight;
            this.fontBold12.draw(0, leftY, 'left and right - adjust model yaw', 0xffff00);
            leftY += this.fontBold12.fontHeight;
            this.fontBold12.draw(0, leftY, 'up and down - adjust model pitch', 0xffff00);
            leftY += this.fontBold12.fontHeight;
            this.fontBold12.draw(0, leftY, '. and / - adjust model roll', 0xffff00);
            leftY += this.fontBold12.fontHeight;
            this.fontBold12.draw(0, leftY, 'w and s - move camera along z axis', 0xffff00);
            leftY += this.fontBold12.fontHeight;
            this.fontBold12.draw(0, leftY, 'a and d - move camera along x axis', 0xffff00);
            leftY += this.fontBold12.fontHeight;
            this.fontBold12.draw(0, leftY, 'q and e - move camera along y axis', 0xffff00);
        }

        this.drawArea?.draw(0, 0);
    };

    // ----

    async loadArchive(filename: string, displayName: string, crc: number, progress: number) {
        await this.showProgress(progress, `Requesting ${displayName}`);
        const data = await Jagfile.loadUrl(`${Playground.HOST}/${filename}${crc}`);
        await this.showProgress(progress, `Loading ${displayName} - 100%`);
        return data;
    }

    modifier = 2;
    model = {
        id: parseInt(GameShell.getParameter('model')) || 0,
        pitch: parseInt(GameShell.getParameter('x')) || 0,
        yaw: parseInt(GameShell.getParameter('y')) || 0,
        roll: parseInt(GameShell.getParameter('z')) || 0
    };
    camera = {
        x: parseInt(GameShell.getParameter('eyeX')) || 0,
        y: parseInt(GameShell.getParameter('eyeY')) || 0,
        z: parseInt(GameShell.getParameter('eyeZ')) || 420,
        pitch: parseInt(GameShell.getParameter('eyePitch')) || 0
    };

    updateKeysPressed() {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const key = this.pollKey();
            if (key === -1) {
                break;
            }

            if (key === 'r'.charCodeAt(0)) {
                this.modifier = 2;
                this.model = {
                    id: this.model.id,
                    pitch: 0,
                    yaw: 0,
                    roll: 0
                };
                this.camera = {
                    x: 0,
                    y: 0,
                    z: 420,
                    pitch: 0
                };
                this.historyRefresh = true;
            } else if (key === '1'.charCodeAt(0)) {
                this.model.id--;
                if (this.model.id < 0 && Model.metadata) {
                    this.model.id = Model.metadata.length - 100 - 1;
                }
                this.historyRefresh = true;
            } else if (key === '2'.charCodeAt(0)) {
                this.model.id++;
                if (Model.metadata && this.model.id >= Model.metadata.length - 100) {
                    this.model.id = 0;
                }
                this.historyRefresh = true;
            }
        }
    }

    updateKeysHeld() {
        if (this.actionKey['['.charCodeAt(0)]) {
            this.modifier--;
        } else if (this.actionKey[']'.charCodeAt(0)]) {
            this.modifier++;
        }

        if (this.actionKey[1]) {
            // left arrow
            this.model.yaw += this.modifier;
            this.historyRefresh = true;
        } else if (this.actionKey[2]) {
            // right arrow
            this.model.yaw -= this.modifier;
            this.historyRefresh = true;
        }

        if (this.actionKey[3]) {
            // up arrow
            this.model.pitch -= this.modifier;
            this.historyRefresh = true;
        } else if (this.actionKey[4]) {
            // down arrow
            this.model.pitch += this.modifier;
            this.historyRefresh = true;
        }

        if (this.actionKey['.'.charCodeAt(0)]) {
            this.model.roll += this.modifier;
            this.historyRefresh = true;
        } else if (this.actionKey['/'.charCodeAt(0)]) {
            this.model.roll -= this.modifier;
            this.historyRefresh = true;
        }

        if (this.actionKey['w'.charCodeAt(0)]) {
            this.camera.z -= this.modifier;
            this.historyRefresh = true;
        } else if (this.actionKey['s'.charCodeAt(0)]) {
            this.camera.z += this.modifier;
            this.historyRefresh = true;
        }

        if (this.actionKey['a'.charCodeAt(0)]) {
            this.camera.x -= this.modifier;
            this.historyRefresh = true;
        } else if (this.actionKey['d'.charCodeAt(0)]) {
            this.camera.x += this.modifier;
            this.historyRefresh = true;
        }

        if (this.actionKey['q'.charCodeAt(0)]) {
            this.camera.y -= this.modifier;
            this.historyRefresh = true;
        } else if (this.actionKey['e'.charCodeAt(0)]) {
            this.camera.y += this.modifier;
            this.historyRefresh = true;
        }

        this.model.pitch = this.model.pitch & 2047;
        this.model.yaw = this.model.yaw & 2047;
        this.model.roll = this.model.roll & 2047;
    }
}

const playground = new Playground();
playground.run().then(() => {});
