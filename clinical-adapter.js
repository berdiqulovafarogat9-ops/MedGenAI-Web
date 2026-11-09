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
      ellipsoid("fallback-upper-arm", 0xd8a98f, side * 0.34, 0.13, 0, 0.095, 0.27, 0.095);
      ellipsoid("fallback-elbow", 0xd8a98f, side * 0.38, -0.08, 0, 0.09, 0.10, 0.09);
      ellipsoid("fallback-forearm", 0xd8a98f, side * 0.39, -0.25, 0, 0.078, 0.22, 0.078);
      ellipsoid("fallback-hand", 0xd8a98f, side * 0.40, -0.43, 0.015, 0.085, 0.105, 0.055);
      ellipsoid("fallback-thigh", 0x24364a, side * 0.13, -0.68, 0, 0.12, 0.31, 0.12);
      ellipsoid("fallback-knee", 0x24364a, side * 0.13, -0.91, 0, 0.095, 0.10, 0.10);
      ellipsoid("fallback-shin", 0x24364a, side * 0.13, -1.07, 0, 0.085, 0.20, 0.085);
      ellipsoid("fallback-foot", 0x17212b, side * 0.13, -1.25, 0.045, 0.105, 0.075, 0.18);
    });
    ellipsoid("fallback-gown-front", 0x9ccbd8, 0, 0.08, 0.145, 0.235, 0.31, 0.045);
    ellipsoid("fallback-gown-collar", 0xe8f1f4, 0, 0.34, 0.105, 0.12, 0.055, 0.035);
    ellipsoid("fallback-ear-left", 0xd8a98f, -0.145, 0.63, 0.015, 0.035, 0.06, 0.035);
    ellipsoid("fallback-ear-right", 0xd8a98f, 0.145, 0.63, 0.015, 0.035, 0.06, 0.035);
    ellipsoid("fallback-hair", 0x26313a, 0, 0.755, -0.015, 0.145, 0.075, 0.14);
    ellipsoid("fallback-eye-left", 0x24313a, -0.052, 0.66, 0.151, 0.012, 0.012, 0.008);
    ellipsoid("fallback-eye-right", 0x24313a, 0.052, 0.66, 0.151, 0.012, 0.012, 0.008);
    ellipsoid("fallback-nose", 0xd8a98f, 0, 0.615, 0.16, 0.025, 0.04, 0.03);
    ellipsoid("fallback-blanket", 0x304b61, 0, -0.86, -0.12, 0.25, 0.38, 0.075);
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