// Polygon that contains a linked set of edges and vertices.
// Each edge is a Segment linked to two Vertex, in a chain.
// Methods provided to split a segment recursively.
// Basic drawing methods using the segments.

// Intersection methods adapted from https://github.com/vrd/js-intersect/blob/gh-pages/solution.js
// License: MIT

import { Vertex } from "./Vertex_class.js";
import { Segment } from "./Segment_class.js";
import { ShadowSegment } from "./ShadowSegment_class.js";
import { locationOf } from "./utility.js";

export class LinkedPolygon extends PIXI.Polygon {  
 /*
  * Construct the map of segments for the polygon.
  * Cached.
  * @type {Map}
  */
  get segments() {
    if(this._segments === undefined || this._segments.size === 0) {
      this._segments = this._constructSegments();
      }
    return this._segments; 
  }
  
 /*
  * Construct the map of vertices for the polygon.
  * Cached. Will remove prior segments, if any.
  * @type {Map}
  */
  get vertices() {
    if(this._vertices === undefined || this._vertices.size === 0) {
      this._segments = undefined;
      this._vertices = this._constructVertices();
    }
    return this._vertices;
  }
  
 /*
  * Set color for the underlying segments.
  * @param {Hex} color    Color to use (default: black)
  */
  setSegmentsColor(color) {
    // set property for each segment
    for(const [key, segment] of this.segments) {
      segment.mergeProperty({ color: color });
    }
  }

 /*
  * Internal function to construct the map of vertices for the polygon
  * Each vertex links to two segments, using the internal Segment and Vertex linking.
  * @return {Map}
  */
  _constructVertices(segment_class = "Segment") {
    const SEGMENT_CLASSES = {
       Segment,
       ShadowSegment
     }
  
    const poly_vertices = new Map();  
    let prior_vertex = new Vertex(this.points[0], this.points[1]);
    let new_vertex;
    prior_vertex.originating_object = this;
    poly_vertices.set(prior_vertex.id, prior_vertex);
    
    //log(`_constructVertices 0:`, prior_vertex, new_vertex);
    
    // save the first id to link at the end
    const l = this.points.length;
    if(this.points[0] !== this.points[l - 2] ||
       this.points[1] !== this.points[l - 1]) {
       console.error(`${MODULE_ID}|_constructVertices expects a closed set of points.`, this);
       }
    
    const first_vertex_id = prior_vertex.id;

    // TO-DO: assuming closed stroke for now.
    for (let i = 2; i < (this.points.length - 2); i += 2) {
      new_vertex = prior_vertex.connectPoint(this.points[i], this.points[i + 1], segment_class);
      //log(`_constructVertices ${i} new_vertex`, new_vertex);
      
      poly_vertices.set(new_vertex.id, new_vertex);
      prior_vertex = new_vertex;
      //log(`_constructVertices ${i} end:`, prior_vertex, new_vertex)
    }
    
    //log(`_constructVertices ended loop`);
    
    // link to beginning
    const last_vertex_id = new_vertex.id;
    
    const s_last_first = SEGMENT_CLASSES[segment_class].fromVertices(poly_vertices.get(last_vertex_id),
                                              poly_vertices.get(first_vertex_id),);
                                                                         
    poly_vertices.get(last_vertex_id).includeSegment(s_last_first)
    
    // to ensure segments are A, B for the vertex, as in prior(A) --> vertex --> next (B)
    // need to insert this s_first_last as A in the first vertex
    const s_first_second =  FirstMapValue(poly_vertices.get(first_vertex_id).segments);
    poly_vertices.get(first_vertex_id).segments.clear();
    poly_vertices.get(first_vertex_id).includeSegment(s_last_first);
    poly_vertices.get(first_vertex_id).includeSegment(s_first_second);
    
    //log(`_constructVertices return`, poly_vertices);

    return poly_vertices;
  }
  
 /*
  * Internal function to build the Map of polygon segments.
  * Each segment shares two vertices with two other segments, linked here
  *   using the internal Segment and Vertex linking.
  * @return {Map}
  */
  _constructSegments() {
    const poly_segments = new Map();

    for(const [key, vertex] of this.vertices) {
      // only add the second segment, so that first<-->last segment is last
      const s_second = SecondMapValue(vertex.segments);

      // Default every segment: 
      //   - "far" until calculateNearFarSegments is run
      //   - "ignore" for vision type (block, shadow, ignore)
      s_second.mergeProperty({ vision_distance: "far", 
                               vision_type: "ignore" });      
      poly_segments.set(s_second.id, s_second);
    }
    return poly_segments;
  }
  
  /*
   * Draw the polygon on the canvas, using the PIXI.Polygon shape from points.
   * @param {Hex} color    Color to use (default: black)
   */
   drawPolygon(color = COLORS.black) {
     canvas.controls.debug.lineStyle(1, color).drawShape(this);
   }
   
  /*
   * Draw the polygon using the individual segments.
   * @param {Hex} default_color Color to use if the segment color property 
   *   has not yet been set.
   */
   draw(default_color = COLORS.black) {
     for(const [key, segment] of this.segments) {    
       const splits = segment.getSplits();
       splits.forEach(s => {
         s.draw(s.properties?.color || default_color);
       });      
     }
   }
   
   
  /*
   * Return Set of polygons that represent the intersection
   *   of two polygons.
   * @param {LinkedPolygon} other_polygon Polygon to compare
   * @return {Set[LinkedPolygon]} Set of polygons, if any
   */
   intersection(other_polygon) {
     return this._setOperation(other_polygon, "intersection");
   }
   
  /*
   * 
   
   
  /*
   * Internal function to handle intersect, union, xor
   * "xor": this polygon minus the other polygon
   * Basic algorithm:
   *   At each intersect point:
   *     - split the segment.
   *     - add the segment from p2 to the split vertex at p1.
   *   At each intersect point for the new "complex" polygon:
   *     - "walk" the polygon
   *     - "multiple worlds":
   *       - start a new walk at any intersection encountered
   *       - also continue existing walk in all new directions
   *     - stop if you hit any vertex previously encountered.
   *     - return a polygon if you return to the start.
   * Possibly use a sweep algorithm for both intersections and 
   *   polygon creation? 
   *   - sweep left to right
   *   - at each point, make a right turn until back to beginning
   *   - at intersection, make new polygon
   *   - intersecting polygons:
   *   -   at intersection, look for rightmost or second line?
   *       or just test for internal overlapping points at the end?
   * @param {LinkedPolygon} other_polygon Polygon to compare
   * @param {String} set_type             Type of set (intersection, union, xor)
   * @return {Set[LinkedPolygon]} Set of polygons, if any
   */
   // http://www.cs.ucr.edu/~eldawy/19SCS133/slides/CS133-05-Intersection.pdf
   // https://github.com/vrd/js-intersect
   _setOperation(other_polygon, set_type = "intersection") {
     const polygons = this.polygonate(other_polygon);
     return this.filterPolygons(polygons, set_type);
   }
   
   
   /*
    * Where the other_polygon intersects with this one, make new points.
    * (e.g., split the segment at the intersection points)
    * @param {LinkedPolygon} other_polygon    The polygon to test.
    */
   edgify(other_polygon) {
     // if the poly
     this.segments.forEach(s => {
       // check every edge for intersection with every edge except itself
       
     });
   }
   
   /*
    * Bentley-Ottmann sweep algorithm to sort vertices and return a list of
    * intersecting points.
    * http://www.cs.ucr.edu/~eldawy/19SCS133/slides/CS133-05-Intersection.pdf
    * TO-DO: advanced version with bounding rectangles
    */
    intersectionPoints(...polygons) {      
      let P = []; // top point of each line segment
      let S = []; // sweep line state: 
                  // {id, score, segment} 
      let intersection_points = [];
      
      // y increases top --> bottom
      // x increases left --> right
      
      // compare "scores", meaning x or y coordinates
      const compareFn = function(a, b) { 
        return almostEqual(a.score, b.score, 1e-5) ? 0 : 
               a.score < b.score ? 1 : -1;
      }
      
      // find the top and bottom points of a segment by y 
      getTopPoint = function(A, B) return (compareFn(A.y, B.y) === 1 ? B : A);
      getBottomPoint = function(A, B) return (compareFn(A.y, B.y)) === 1 ? A : B);
      
      [...polygons].concat(this).forEach(p => {
        p.segments.forEach(s => {
          // find the top segment; add to P
          P.push(getTopPoint(s));
        });
      });
      
      
      // sort such that top of the list is at end of array, 
      //   so we can pop the top point
      P.sort(P_compare);
      log(`intersectionPoints sorted`, P);
      
      while(P.length > 0) {
        const p = P.pop();
        
        // TO-DO: use splice or some other method to insert into the sorted arrays?
        // https://stackoverflow.com/questions/1344500/efficient-way-to-insert-a-number-into-a-sorted-array-of-numbers
        
        p.segments.forEach(s => {
          const top_p = getTopPoint(s);
          const bottom_p = getBottomPoint(s);
        
          if(p.equal(top_p)) {
            // p is the top point for the segment
            const i = locationOf(top_p.x, S, compareFn);
            S.push({ id: s.id, score: top_p.x, segment: s })
            S.sort(compareFn);
            
            this._checkIntersection(i - 1, i, P, S, p.y)             
            this._checkIntersection(i, i + 1, P, S, p.y)
            
            // add end point to P
            P.push(getBottomPoint(s));
            P.sort(P_compare); 
          } else if(p.equal(bottom_p)) {
            // p is the bottom point for the segment
            // Remove the segment from S
            S.delete(s.id);
            const i = locationOf(top_p.x, S, compareFn);
            S_queue.splice(i, 1)
            
            this._checkIntersection(i - 1, i, P, S, p.y)
          
          } else {
            // p is interior point
            // report as intersection
            intersection_points.push(p);
            const i = locationOf(top_p.x, S, compareFn);
            if(S.length > (i + 1)) {
              // swap Si, Si+1
              S.slice(i, 2, S[i + 1], S[i])
            }
            this._checkIntersection(i - 1, i, P, S, p.y)             
            this._checkIntersection(i + 1, i + 2, P, S, p.y) 
          }
        
        }); // p.segments.forEach
      } // while(P.length > 0)
      
      return intersections;
    }
    
    _checkIntersection(idx1, idx2, P, S, sweep_y) {
      if(S.length <= idx1 || S.length <= idx2) { return };
    
      const s1 = S[idx1].segment;
      const s2 = S[idx2].segment;
      
      const intersect_p = this._checkIntersection(s1, s2, P, sweep_y);
      if(intersect_p) { P.push({ intersection: intersect_p, s1: s1, s2: s2 }); } 
    }
    
    _getIntersectionPoint(s1, s2, P, sweep_y) {
      const intersect_p = s1.intersectSegment(s2);
      if(!intersect_p) return undefined;
      if(intersect_p.y < sweep_y) return undefined; // above the sweep line
      if(P.some(elem => { elem.equals(intersect_p )})) return undefined; // already in P      
      return Vertex.fromPoint(intersect_p);

    }    
     
} 