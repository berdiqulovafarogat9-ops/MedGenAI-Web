/* MedGen AI — additive Full Code scene calibration.
 * Reuses the active Three.js scene, camera and renderer. Never creates a second
 * renderer/RAF, clears the viewport, or replaces the clinical action/raycast chain.
 */
(function (global) {
  "use strict";
  function apply(scene, camera, renderer, viewport) {
    if (!global.THREE || !scene || !camera || !renderer || !viewport) return false;
    if (scene.getObjectByName("medgen_fullcode_room_calibration")) return true;

    scene.background = new THREE.Color(0x0a1018);
    scene.fog = new THREE.FogExp2(0x0a1018, 0.018);

    // Darken the existing procedural floor without replacing the bed or equipment.
    scene.children.forEach(function (obj) {
      if (obj && obj.isMesh && obj.geometry && obj.geometry.type === "PlaneGeometry" &&
          obj.material && obj.material.color && obj.position.y <= 0.02) {
        obj.material.color.setHex(0x1e293b);
        obj.material.roughness = 0.72;
        obj.material.metalness = 0.04;
        obj.material.needsUpdate = true;
      }
    });

    var room = new THREE.Group();
    room.name = "medgen_fullcode_room_calibration";
    var wallMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.92, side: THREE.DoubleSide });
    var trimMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, metalness: 0.12 });
    var back = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.2), wallMat);
    back.position.set(0, 1.55, -2.31);
    back.receiveShadow = true;
    room.add(back);
    var left = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.2), wallMat);
    left.rotation.y = Math.PI / 2;
    left.position.set(-2.65, 1.55, 0.15);
    left.receiveShadow = true;
    room.add(left);

    // Wall-mounted clinical gas/oxygen outlet console; bedside monitor and IV stand
    // already exist in the main simulator and are intentionally reused.
    var console = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.28, 0.09), trimMat);
    console.position.set(0.15, 1.82, -2.23);
    room.add(console);
    [-0.52, -0.12, 0.28, 0.68].forEach(function (x, i) {
      var port = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.018, 16),
        new THREE.MeshStandardMaterial({ color: [0x38bdf8, 0x22c55e, 0xf59e0b, 0xe2e8f0][i], metalness: 0.2 })
      );
      port.rotation.x = Math.PI / 2;
      port.position.set(x, 1.82, -2.17);
      room.add(port);
    });
    scene.add(room);

    // Camera calibration only: keep the existing patient wrapper, bed and hotspots.
    camera.position.set(2.8, 2.2, 3.2);
    camera.lookAt(0, 0.72, -0.25);
    camera.updateProjectionMatrix();
    renderer.setClearColor(0x0a1018, 1);
    renderer.setSize(Math.max(viewport.clientWidth, 1), Math.max(viewport.clientHeight, 1), false);
    renderer.render(scene, camera);
    return true;
  }
  global.MedGenVitals3D = Object.freeze({ apply: apply });
})(window);
