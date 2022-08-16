/* globals

*/
"use strict";

import { log } from "./util.js";
import { ElevationGrid } from "./ElevationGrid.js";
import * as drawing from "./drawing.js";

/* Elevation layer

Allow the user to "paint" areas with different elevations. This elevation data will then
be used by the light shader (and eventually the vision shader) to identify areas that
are not in shadow. For example, a mesa at 30' elevation should cast a shadow but should
not cast a shadow on itself.
  _____ <- no shadow
 /     \
/       \--- <- shadow area

Set elevation in grid increments. Maximum 265; use texture (sprite?) to store.

Anticipated UI:

Controls:
- Current elevation for painting. Scroll wheel to increment / decrement
- Tool to fill by grid square
- Tool to fill all space contained between walls
- Tool to fill by pixel. Resize and choose shape: grid square, hex, circle. Reset size to grid size.
- Reset
- Undo

On canvas:
- hover to see the current elevation value
- Elevation indicated as shaded color going from red (low) to blue (high)
- Solid lines representing walls of different heights. Near white for infinite.
*/

export class ElevationLayer extends InteractionLayer {
  constructor() {
    super();
    this.elevationGrid = new ElevationGrid(); // Have to set manually after canvas dimensions are set
    this.controls = ui.controls.controls.find(obj => obj.name === "elevation");
  }

  /**
   * The elevationGrid overlay container
   * @type {FullCanvasContainer}
   */
  elevationGridContainer;


  get elevation() {
    return this.#elevation;
  }

  set elevation(value) {
    this.#elevation = value;
    canvas.primary.sortChildren();
  }

  #elevation = 9000;

  /** @override */
  static get layerOptions() {
    return mergeObject(super.layerOptions, {
      name: "Elevation",
    });
  }

  /** @override */
  async _draw(options) {
//     this.weatherOcclusionFilter = InverseOcclusionMaskFilter.create({
//       alphaOcclusion: 0,
//       uMaskSampler: canvas.masks.tileOcclusion.renderTexture,
//       channel: "b"
//     });
    if ( canvas.elevation.active ) this.drawElevation();
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _tearDown(options) {
    this.elevationGridContainer = null;
    return super._tearDown();
  }

  /* -------------------------------------------- */

  /**
   * Draw the weather container.
   * @returns {FullCanvasContainer|null}    The weather container, or null if no effect is present
   */
  drawElevation() {
    // Draw walls
    for ( const wall of canvas.walls.placeables ) {
      drawing.drawSegment(wall, { color: drawing.COLORS.red });
      drawing.drawPoint(wall.A, { color: drawing.COLORS.red });
      drawing.drawPoint(wall.B, { color: drawing.COLORS.red });
    }

    // Create the effect and begin playback
    if ( !this.elevationGridContainer ) {
      const w = new FullCanvasContainer();
      w.accessibleChildren = w.interactiveChildren = false;
      w.filterArea = canvas.app.renderer.screen;
      this.elevationGridContainer = this.addChild(w);
    }

    const elevationFilter = ElevationFilter.create({
      width: canvas.dimensions.width,
      height: canvas.dimensions.height
    });
    this.elevationGridContainer.filters = [elevationFilter];
    return this.elevationGridContainer;
  }

  /* ----- Event Listeners and Handlers ----- /*

  /**
   * If the user clicks a canvas location, change its elevation using the selected tool.
   * @param {PIXI.InteractionEvent} event
   */
  _onClickLeft(event) {
    const { x, y } = event.data.origin;
    const activeTool = this.controls.activeTool;
    const currE = this.controls.currentElevation;

    log(`clickLeft at ${x},${y} with tool ${activeTool} and elevation ${currE}`, event);

    switch ( activeTool ) {
      case "fill-by-grid":
        this._fillGridSpace(x, y, currE);
        break;
      case "fill-by-pixel":
        log("fill-by-pixel not yet implemented.");
        break;
      case "fill-space":
        log("fill-space not yet implemented.");
        break;
    }

    // Standard left-click handling
    super._onClickLeft(event);
   }

   _fillGridSpace(x, y, elevation) {
     const [gx, gy] = canvas.grid.grid.getGridPositionFromPixels(x, y);
     this.elevationGrid.setGridSpaceToElevation(gx, gy, elevation)
   }

}


class ElevationFilter extends AbstractBaseFilter {
  static defaultUniforms = {
    width: 1,
    height: 1
  };

  static fragmentShader = `
  uniform float width;
  uniform float height;

  void main() {
    vec2 u_resolution = vec2(width, height);
    vec2 st = gl_FragCoord.xy / u_resolution;
    gl_FragColor = vec4(st.x, st.y, 0.5, 1.0);
  }
  `

//   static fragmentShader = `
//   varying vec2 vTextureCoord;
//   uniform sampler2D uSampler;
//   uniform vec3 color;
//   uniform float alpha;
//   uniform vec2 u_resolution;
//
//   void main() {
//     vec4 tex = texture2D(uSampler, vTextureCoord);
//     vec2 st = gl_FragCoord.xy/u_resolution;
//     gl_FragColor = vec4(st.x,st.y,0.0,1.0);
//     // gl_FragColor = vec4(st.x, st.y, 0.0, 0.75);
//     // gl_FragColor = vec4(tex.x, tex.y, 0.0, 0.75);
//   }
//   `;

}


/*
renderer = canvas.app.renderer
gl = renderer.gl;

*/
