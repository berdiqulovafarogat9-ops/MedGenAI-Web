/* MedGen AI — visible hospital-room treatment for the existing Jasur scene.
 * Reuses the active scene/camera/renderer. No duplicate patient, bed, canvas or RAF.
 */
(function (global) {
  "use strict";
  function apply(scene, camera, renderer, viewport) {
    if (!global.THREE || !scene || !camera || !renderer || !viewport) return false;
    if (scene.getObjectByName("medgen_visible_room_shell")) return true;

    var T = global.THREE;
    scene.background = new T.Color(0x0a1018);
    scene.fog = new T.Fog(0x0a1018, 8, 22);

    // The existing floor is a large PlaneGeometry at y=0. Use an unlit material
    // so strong clinical lights cannot wash it out to pale blue/white.
    scene.traverse(function (obj) {
      if (obj && obj.isMesh && obj.geometry &&
          obj.geometry.type === "PlaneGeometry" &&
          Math.abs(obj.position.y) < 0.03 &&
          obj.geometry.parameters &&
          obj.geometry.parameters.width >= 8) {
        obj.material = new T.MeshBasicMaterial({ color: 0x1e293b });
        obj.receiveShadow = true;
      }
    });

    // The previous implementation searched for a back wall that did not exist.
    // Add a clearly visible room shell behind the existing bed and monitor.
    var shell = new T.Group();
    shell.name = "medgen_visible_room_shell";
    var wallMat = new T.MeshBasicMaterial({ color: 0x0f172a, side: T.DoubleSide });
    var sideMat = new T.MeshBasicMaterial({ color: 0x111f30, side: T.DoubleSide });
    var trimMat = new T.MeshBasicMaterial({ color: 0x334155 });
    var back = new T.Mesh(new T.PlaneGeometry(7.5, 3.4), wallMat);
    back.name = "medgen_hospital_back_wall";
    back.position.set(0, 1.65, -2.35);
    shell.add(back);
    var left = new T.Mesh(new T.PlaneGeometry(4.8, 3.4), sideMat);
    left.name = "medgen_hospital_left_wall";
    left.rotation.y = Math.PI / 2;
    left.position.set(-2.7, 1.65, 0.05);
    shell.add(left);
    var right = new T.Mesh(new T.PlaneGeometry(4.8, 3.4), sideMat);
    right.name = "medgen_hospital_right_wall";
    right.rotation.y = -Math.PI / 2;
    right.position.set(2.7, 1.65, 0.05);
    shell.add(right);
    // Wall-mounted gas rail and color-coded outlets.
    var rail = new T.Mesh(new T.BoxGeometry(1.8, 0.16, 0.08), trimMat);
    rail.position.set(0.1, 1.85, -2.28);
    shell.add(rail);
    [0x38bdf8, 0x22c55e, 0xf59e0b, 0xe2e8f0].forEach(function (color, i) {
      var outlet = new T.Mesh(new T.CircleGeometry(0.055, 16),
        new T.MeshBasicMaterial({ color: color }));
      outlet.position.set(-0.55 + i * 0.4, 1.85, -2.225);
      shell.add(outlet);
    });
    scene.add(shell);

    camera.position.set(2.8, 2.2, 3.2);
    camera.lookAt(0, 0.72, -0.25);
    var w = Math.max(viewport.clientWidth, 1);
    var h = Math.max(viewport.clientHeight, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setClearColor(0x0a1018, 1);
    renderer.setSize(w, h, false);
    renderer.render(scene, camera);
    console.info("[MedGen 3D] Visible hospital room shell attached", {
      floor: !!scene.getObjectByName(""), width: w, height: h
    });
    return true;
  }
  global.MedGenVitals3D = Object.freeze({ apply: apply });
})(window);
