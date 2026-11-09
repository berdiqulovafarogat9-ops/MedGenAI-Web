/* MedGen AI — clinical UI fallback helpers. Presentation-only; never changes VitalsCore or scoring. */
(function () {
  "use strict";
  function mannequin(parent, THREERef) {
    var T = THREERef || window.THREE;
    if (!parent || !T) return null;
    var group = new T.Group();
    group.name = "medgen-geometric-fallback-patient";
    function ellipsoid(name, color, x, y, z, sx, sy, sz) {
      var mesh = new T.Mesh(
        new T.SphereGeometry(1, 20, 14),
        new T.MeshStandardMaterial({ color: color, roughness: 0.82 })
      );
      mesh.name = name;
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    }
    // Supine mannequin in the patient's local coordinate system.
    ellipsoid("fallback-torso", 0x38bdf8, 0, 0.02, 0, 0.29, 0.43, 0.17);
    ellipsoid("fallback-pelvis", 0x2563a8, 0, -0.36, 0, 0.27, 0.20, 0.17);
    ellipsoid("fallback-head", 0xf2c6a8, 0, 0.62, 0.015, 0.15, 0.17, 0.15);
    ellipsoid("fallback-neck", 0xd9a98d, 0, 0.45, 0, 0.09, 0.10, 0.09);
    [-1, 1].forEach(function (side) {
      ellipsoid("fallback-upper-arm", 0xe7b99c, side * 0.34, 0.13, 0, 0.10, 0.27, 0.10);
      ellipsoid("fallback-forearm", 0xe7b99c, side * 0.39, -0.13, 0, 0.085, 0.25, 0.085);
      ellipsoid("fallback-thigh", 0x24364a, side * 0.13, -0.68, 0, 0.12, 0.31, 0.12);
      ellipsoid("fallback-shin", 0x24364a, side * 0.13, -0.98, 0, 0.09, 0.25, 0.09);
      ellipsoid("fallback-foot", 0x1e293b, side * 0.13, -1.20, 0.045, 0.10, 0.10, 0.17);
    });
    parent.add(group);
    return group;
  }
  window.ClinicalUIAdapter = {
    renderFallbackMannequin: function (scene, patientGroup) {
      if (!window.THREE || !scene) return null;
      return mannequin(patientGroup || scene, window.THREE);
    }
  };
})();