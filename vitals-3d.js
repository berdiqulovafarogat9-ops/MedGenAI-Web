/* MedGen AI — calibrate the EXISTING Jasur clinical scene.
 * No second room, bed, renderer, canvas, GLB loader or animation loop is created.
 */
(function (global) {
  "use strict";
  function apply(scene, camera, renderer, viewport) {
    if (!global.THREE || !scene || !camera || !renderer || !viewport) return false;

    scene.background = new THREE.Color(0x0a1018);
    scene.fog = new THREE.FogExp2(0x0a1018, 0.012);

    var changedFloor = false;
    var changedBackWall = false;
    scene.traverse(function (obj) {
      if (!obj || !obj.isMesh || !obj.material) return;
      var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      // Existing floor plane: dark clinical linoleum.
      if (obj.geometry && obj.geometry.type === "PlaneGeometry" &&
          Math.abs(obj.position.y) < 0.03 && !changedFloor) {
        mats.forEach(function (m) {
          if (m.color) m.color.setHex(0x1e293b);
          if ("roughness" in m) m.roughness = 0.82;
          if ("metalness" in m) m.metalness = 0.02;
          m.needsUpdate = true;
        });
        changedFloor = true;
      }
      // Existing 7 x 3.2 m back wall is a BoxGeometry, not a plane.
      if (obj.geometry && obj.geometry.type === "BoxGeometry" &&
          Math.abs(obj.position.z + 2.25) < 0.08 &&
          Math.abs(obj.position.y - 1.55) < 0.08 &&
          obj.geometry.parameters &&
          obj.geometry.parameters.width >= 6.8 &&
          obj.geometry.parameters.height >= 3.0) {
        mats.forEach(function (m) {
          if (m.color) m.color.setHex(0x0f172a);
          if ("roughness" in m) m.roughness = 0.96;
          m.needsUpdate = true;
        });
        changedBackWall = true;
      }
    });

    // Keep existing equipment and patient placement; change only the viewpoint.
    camera.position.set(2.8, 2.2, 3.2);
    camera.lookAt(0, 0.72, -0.25);
    camera.updateProjectionMatrix();
    renderer.setClearColor(0x0a1018, 1);

    var w = Math.max(viewport.clientWidth, 1);
    var h = Math.max(viewport.clientHeight, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    renderer.render(scene, camera);

    console.info("[MedGen 3D] Existing scene calibrated", {
      floor: changedFloor, backWall: changedBackWall,
      viewport: w + "x" + h
    });
    return true;
  }
  global.MedGenVitals3D = Object.freeze({ apply: apply });
})(window);
