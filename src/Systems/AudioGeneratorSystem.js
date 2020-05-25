import { System } from "ecsy";
import * as THREE from "three";
import { levels } from "../levels.js";
import { Object3D, Transform, Active, GLTFModel } from "ecsy-three";
import TWEEN from "../vendor/tween.module.min.js";

import { Pad, FTTAnalizable, Level, Element } from "../Components/components";

export class AudioGeneratorSystem extends System {
  init() {
    console.log("init");
    this.analyser = null;
    this.ftt = null;
    this.prevAvg = 0;
    this.count = 0;
    this.level = null;
    this.timeOffset;
  }

  execute(delta, time) {
    // Get Level parameters
    this.queries.levels.added.forEach(entity => {
      this.level = levels[entity.getComponent(Level).value];
    });

    // Initialize FFT
    this.queries.sounds.added.forEach(entity => {
      const soundComp = entity.getMutableComponent(FTTAnalizable);

      var AudioContext = window.AudioContext || window.webkitAudioContext;
      var audioCtx = new AudioContext();

      var mediaElement = new Audio(this.level.song);
      mediaElement.loop = true;
      mediaElement.listener = this.listener;
      mediaElement.onplay = () => {
        this.timeOffset = performance.now();
      };

      var delay = new DelayNode(audioCtx, {
        delayTime: 1,
        maxDelayTime: 1
      });

      var source = audioCtx.createMediaElementSource(mediaElement);
      this.analyser = audioCtx.createAnalyser();
      this.analyser.fftSize = soundComp.size;
      source.loop = true;
      source.connect(this.analyser);
      source.connect(delay).connect(audioCtx.destination);
      source.mediaElement.play();
    });

    this.queries.sounds.removed.forEach(entity => {
      this.analyser = null;
    });

    let padsQuery = this.queries.pads;

    // Initialize pads
    padsQuery.added.forEach(entity => {
      const mesh = entity.getComponent(Object3D).value;
      mesh.visible = false;
      console.log("Pad added");
    });
    padsQuery.removed.forEach(entity => {
      // Nothing to do
    });

    // Process FFT data
    var data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    this.processPass(data);
  }

  processPass(data) {
    const sum = data.reduce((a, b) => a + b, 0);
    const avg = sum / data.length || 0;
    if (this.prevAvg > avg && avg > this.level.minDb) {
      // Only sample out of ten
      if (this.count % 10 == 0) {
        var entity = this.queries.pads.results.find(entity => {
          return !entity.getComponent(Active).value;
        });

        if (!entity) {
          return;
        }

        var active = entity.getMutableComponent(Active);
        active.value = true;

        var object = entity.getMutableComponent(Object3D);
        object.value.visible = true;

        // setTimeout(() => {
        //     active.value = false;
        //     object.value.visible = false;
        //     object.value.position.set(0,0,0);
        //     object.value.rotation.set(0,0,0);
        // }, 500);

        var randX = Math.random() * this.level.sizeX;
        var randY = Math.random() * this.level.sizeY;
        const h = (randX * randY) / (this.level.sizeX * this.level.sizeY);
        const color = new THREE.Color();
        color.setHSL(h, 1.0, 0.5);
        object.value.material.color.set(color);
        const ANGLE = Math.PI / (this.level.sizeX * 2);
        object.value.rotateOnAxis(
          new THREE.Vector3(0, 1, 0),
          2 * ANGLE - randX * ANGLE
        );
        object.value.translateY(1 + randY * 2);
        object.value.translateZ(-10);
        var targetPosition = object.value.position.clone();
        object.value.translateZ(-10);
        new TWEEN.Tween(object.value.position)
          .to(targetPosition, 1000)
          .onComplete(() => {
            active.value = false;
            object.value.visible = false;
            object.value.position.set(0, 0, 0);
            object.value.rotation.set(0, 0, 0);
          })
          .start();
      }
      this.count++;
    }
    this.prevAvg = avg;
  }
}

AudioGeneratorSystem.queries = {
  sounds: {
    components: [FTTAnalizable],
    listen: {
      added: true,
      removed: true,
      changed: true
    }
  },
  pads: {
    components: [Pad, Element, Object3D],
    listen: {
      added: true,
      removed: true,
      changed: true
    }
  },
  levels: {
    components: [Level],
    listen: {
      added: true,
      changed: true
    }
  }
};
