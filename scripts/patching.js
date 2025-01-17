/* globals
LightSource,
Wall,
VisionSource,
SoundSource,
MovementSource
Token,
libWrapper,
ClockwiseSweepPolygon,
CanvasVisionMask,
GlobalLightSource
*/

"use strict";

// Patches

import { MODULE_ID } from "./const.js";
import { zValue, log } from "./util.js";
import { getSetting, SETTINGS } from "./settings.js";

import {
  testVisibilityDetectionMode,
  testVisibilityLightSource,
  _testLOSDetectionMode,
  _testRangeDetectionMode,
  _refreshToken,
  cloneToken//,
//   updatePositionToken//,
//   _onUpdateToken
} from "./tokens.js";

import {
  createAdaptiveLightingShader,
  _updateColorationUniformsLightSource,
  _updateIlluminationUniformsLightSource,
  _updateEVLightUniformsLightSource,
  _createPolygonLightSource
} from "./lighting.js";

import {
  refreshCanvasVisibilityPolygons,
  refreshCanvasVisibilityShader,
  createVisionCanvasVisionMask,
  clearCanvasVisionMask,
  _getEVTexture
} from "./vision.js";

import {
  _computeClockwiseSweepPolygon,
  _drawShadowsClockwiseSweepPolygon,
  _testShadowWallInclusionClockwisePolygonSweep,
  testCollision3dClockwiseSweepPolygon,
  _testCollision3dClockwiseSweepPolygon
} from "./clockwise_sweep.js";

export function registerAdditions() {

  if ( !Object.hasOwn(MovementSource.prototype, "elevationZ") ) {
    Object.defineProperty(MovementSource.prototype, "elevationZ", {
      get: movementSourceElevation
    });
  }

  if ( !Object.hasOwn(VisionSource.prototype, "elevationZ") ) {
    Object.defineProperty(VisionSource.prototype, "elevationZ", {
      get: visionSourceElevation
    });
  }

  if ( !Object.hasOwn(LightSource.prototype, "elevationZ") ) {
    Object.defineProperty(LightSource.prototype, "elevationZ", {
      get: lightSourceElevation
    });
  }

  if ( !Object.hasOwn(SoundSource.prototype, "elevationZ") ) {
    Object.defineProperty(SoundSource.prototype, "elevationZ", {
      get: soundSourceElevation
    });
  }

  if ( !Object.hasOwn(Wall.prototype, "topZ") ) {
    Object.defineProperty(Wall.prototype, "topZ", {
      get: wallTop
    });
  }

  if ( !Object.hasOwn(Wall.prototype, "bottomZ") ) {
    Object.defineProperty(Wall.prototype, "bottomZ", {
      get: wallBottom
    });
  }

  if ( !Object.hasOwn(Token.prototype, "topZ") ) {
    Object.defineProperty(Token.prototype, "topZ", {
      get: tokenTop
    });
  }

  if ( !Object.hasOwn(Token.prototype, "bottomZ") ) {
    Object.defineProperty(Token.prototype, "bottomZ", {
      get: tokenBottom
    });
  }

  Object.defineProperty(LightSource.prototype, "_updateEVLightUniforms", {
    value: _updateEVLightUniformsLightSource,
    writable: true,
    configurable: true
  });

  Object.defineProperty(VisionSource.prototype, "_updateEVVisionUniforms", {
    value: _updateEVLightUniformsLightSource,
    writable: true,
    configurable: true
  });

  Object.defineProperty(ClockwiseSweepPolygon.prototype, "_drawShadows", {
    value: _drawShadowsClockwiseSweepPolygon,
    writable: true,
    configurable: true
  });

  Object.defineProperty(ClockwiseSweepPolygon.prototype, "_testShadowWallInclusion", {
    value: _testShadowWallInclusionClockwisePolygonSweep,
    writable: true,
    configurable: true
  });

  Object.defineProperty(ClockwiseSweepPolygon, "testCollision3d", {
    value: testCollision3dClockwiseSweepPolygon,
    writable: true,
    configurable: true
  });

  Object.defineProperty(ClockwiseSweepPolygon.prototype, "_testCollision3d", {
    value: _testCollision3dClockwiseSweepPolygon,
    writable: true,
    configurable: true
  });

  if ( getSetting(SETTINGS.VISION_USE_SHADER) ) {
    // Set up similar pool of RenderTexture objects as that of the FogManager
    // Here, for CanvasVisionMask
    Object.defineProperty(CanvasVisionMask.prototype, "_EV_textures", {
      value: [],
      writable: true,
      configurable: true
    });

    Object.defineProperty(CanvasVisionMask.prototype, "_getEVTexture", {
      value: _getEVTexture,
      writable: true,
      configurable: true
    });
  }
}

export function registerPatches() {
  // ----- Locating edges that create shadows in the LOS ----- //
  libWrapper.register(MODULE_ID, "ClockwiseSweepPolygon.prototype._compute", _computeClockwiseSweepPolygon, libWrapper.WRAPPER, {perf_mode: libWrapper.PERF_FAST});

  // ----- Shader code for drawing shadows ----- //
  libWrapper.register(MODULE_ID, "AdaptiveLightingShader.create", createAdaptiveLightingShader, libWrapper.WRAPPER);

  // ----- Drawing shadows for light sources ----- //
  libWrapper.register(MODULE_ID, "LightSource.prototype._updateColorationUniforms", _updateColorationUniformsLightSource, libWrapper.WRAPPER, {perf_mode: libWrapper.PERF_FAST});
  libWrapper.register(MODULE_ID, "LightSource.prototype._updateIlluminationUniforms", _updateIlluminationUniformsLightSource, libWrapper.WRAPPER, {perf_mode: libWrapper.PERF_FAST});
  libWrapper.register(MODULE_ID, "LightSource.prototype._createPolygon", _createPolygonLightSource, libWrapper.WRAPPER, {perf_mode: libWrapper.PERF_FAST});

  // ----- Visibility testing ----- //
  libWrapper.register(MODULE_ID, "LightSource.prototype.testVisibility", testVisibilityLightSource, libWrapper.MIXED, {perf_mode: libWrapper.PERF_FAST});
  libWrapper.register(MODULE_ID, "DetectionMode.prototype.testVisibility", testVisibilityDetectionMode, libWrapper.WRAPPER, {perf_mode: libWrapper.PERF_FAST});
  libWrapper.register(MODULE_ID, "DetectionMode.prototype._testRange", _testRangeDetectionMode, libWrapper.WRAPPER, {perf_mode: libWrapper.PERF_FAST});
  libWrapper.register(MODULE_ID, "DetectionMode.prototype._testLOS", _testLOSDetectionMode, libWrapper.WRAPPER, {perf_mode: libWrapper.PERF_FAST});

  // ----- Drawing shadows for vision source LOS, fog  ----- //
  if ( getSetting(SETTINGS.VISION_USE_SHADER) ) {
    libWrapper.register(MODULE_ID, "CanvasVisibility.prototype.refresh", refreshCanvasVisibilityShader, libWrapper.OVERRIDE, {perf_mode: libWrapper.PERF_FAST});
    libWrapper.register(MODULE_ID, "CanvasVisionMask.prototype.createVision", createVisionCanvasVisionMask, libWrapper.OVERRIDE, {perf_mode: libWrapper.PERF_FAST});
    libWrapper.register(MODULE_ID, "CanvasVisionMask.prototype.clear", clearCanvasVisionMask, libWrapper.WRAPPER, {perf_mode: libWrapper.PERF_FAST});

  } else {
    libWrapper.register(MODULE_ID, "CanvasVisibility.prototype.refresh", refreshCanvasVisibilityPolygons, libWrapper.OVERRIDE, {perf_mode: libWrapper.PERF_FAST});
  }

  // ----- Token animation and elevation change ---- //
  libWrapper.register(MODULE_ID, "Token.prototype.clone", cloneToken, libWrapper.WRAPPER, {perf_mode: libWrapper.PERF_FAST});
  libWrapper.register(MODULE_ID, "Token.prototype._refresh", _refreshToken, libWrapper.WRAPPER, {perf_mode: libWrapper.PERF_FAST});
}

/**
 * For MovementSource objects, use the token's elevation
 * @type {number} Elevation, in grid units to match x,y coordinates.
 */
function movementSourceElevation() {
  return this.object.topZ;
}

/**
 * For VisionSource objects, use the token's elevation.
 * @type {number} Elevation, in grid units to match x,y coordinates.
 */
function visionSourceElevation() {
  return this.object.topZ;
}

/**
 * For LightSource objects, default to infinite elevation.
 * This is to identify lights that should be treated like in default Foundry.
 * @type {number} Elevation, in grid units to match x,y coordinates.
 */
function lightSourceElevation() {
  if ( this instanceof GlobalLightSource ) return Number.POSITIVE_INFINITY;
  return zValue(this.object.document.flags?.levels?.rangeTop ?? Number.POSITIVE_INFINITY);
}

/**
 * For SoundSource objects, default to 0 elevation.
 * @type {number} Elevation, in grid units to match x,y coordinates.
 */
function soundSourceElevation() {
  return zValue(this.object.document.flags?.levels?.rangeTop ?? Number.POSITIVE_INFINITY);
}

/**
 * For Token objects, default to 0 elevation.
 * @type {number} Elevation, in grid units to match x,y coordinates.
 */
function tokenTop() {
  // From Wall Height but skip the extra test b/c we know it is a token.
  return zValue(this.losHeight ?? 0);
}

/**
 * For Token objects, default to 0 elevation.
 * @type {number} Elevation, in grid units to match x,y coordinates.
 */
function tokenBottom() {
  // From Wall Height but skip the extra test b/c we know it is a token.
  return zValue(this.document.elevation ?? 0);
}

/**
 * For Wall objects, default to infinite top/bottom elevation.
 * @type {number} Elevation, in grid units to match x,y coordinates.
 */
function wallTop() {
  return zValue(this.document.flags?.["wall-height"]?.top ?? Number.POSITIVE_INFINITY);
}

/**
 * For Wall objects, default to infinite top/bottom elevation.
 * @type {number} Elevation, in grid units to match x,y coordinates.
 */
function wallBottom() {
  return zValue(this.document.flags?.["wall-height"]?.bottom ?? Number.NEGATIVE_INFINITY);
}

