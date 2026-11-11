/* MedGen AI — Full Code style clinical room, attached to the existing simulator scene.
   Reuses the live renderer/camera/scene; never creates a second canvas, patient or RAF. */
(function (global) {
  "use strict";
  function apply(scene, camera, renderer, viewport) {
    if (!global.THREE || !scene || !camera || !renderer || !viewport) return false;
    if (scene.getObjectByName("medgen_fullcode_room_v4")) return true;
    var T=global.THREE;
    scene.background=new T.Color(0x17212b);
    scene.fog=new T.Fog(0x17212b,9,24);

    // Dark, non-washed-out clinical vinyl floor.
    scene.traverse(function(o){
      if(o&&o.isMesh&&o.geometry&&o.geometry.type==="PlaneGeometry"&&
         o.geometry.parameters&&o.geometry.parameters.width>=8&&Math.abs(o.position.y)<0.04){
        o.material=new T.MeshBasicMaterial({color:0x34414b});
        o.receiveShadow=true;
      }
    });

    var room=new T.Group(); room.name="medgen_fullcode_room_v4";
    var wall=new T.MeshStandardMaterial({color:0xd7dde0,roughness:.92});
    var lowerWall=new T.MeshStandardMaterial({color:0x9bb9b7,roughness:.95});
    var trim=new T.MeshStandardMaterial({color:0x53636c,metalness:.35,roughness:.55});
    var dark=new T.MeshStandardMaterial({color:0x202b33,roughness:.72});
    var glass=new T.MeshStandardMaterial({color:0x8fc8dc,roughness:.18,metalness:.08,transparent:true,opacity:.62});
    var white=new T.MeshStandardMaterial({color:0xe9eef0,roughness:.82});
    function box(name,w,h,d,x,y,z,mat){
      var m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.name=name;m.position.set(x,y,z);
      m.castShadow=true;m.receiveShadow=true;room.add(m);return m;
    }
    // Rear wall with clinical two-tone lower protection panel.
    box("rear_wall",6.8,3.2,.16,0,1.62,-2.45,wall);
    box("rear_wall_clinical_panel",6.78,.92,.18,0,.48,-2.34,lowerWall);
    box("rear_wall_guard_rail",6.8,.055,.08,0,.98,-2.23,trim);
    // Side walls create an actual room enclosure while leaving the front open to camera.
    box("left_wall",.16,3.2,4.9,-3.35,1.62,.0,wall);
    box("left_wall_lower_panel",.18,.92,4.85,-3.25,.48,0,lowerWall);
    box("right_wall",.16,3.2,4.9,3.35,1.62,0,wall);
    box("right_wall_lower_panel",.18,.92,4.85,3.25,.48,0,lowerWall);
    // Large glazed window and frame on left wall.
    box("window_frame",.10,1.45,1.95,-3.22,2.05,-.25,trim);
    box("window_glass",.055,1.30,1.78,-3.15,2.05,-.25,glass);
    box("window_mullion_v",.06,1.34,.045,-3.10,2.05,-.25,white);
    box("window_mullion_h",.06,.045,1.82,-3.10,2.05,-.25,white);
    // Rear medical gas rail and outlets.
    box("medical_gas_rail",2.35,.18,.12,.15,1.78,-2.30,trim);
    [0x38bdf8,0x22c55e,0xf59e0b,0xe2e8f0].forEach(function(c,i){
      var o=new T.Mesh(new T.CircleGeometry(.075,20),new T.MeshBasicMaterial({color:c}));
      o.position.set(-.72+i*.55,1.78,-2.22);room.add(o);
    });
    // Ceiling luminaires (visible panels, no full ceiling occlusion).
    box("ceiling_light_left",1.35,.045,.55,-1.25,3.12,-.55,white);
    box("ceiling_light_right",1.35,.045,.55,1.15,3.12,-.55,white);
    // Storage cabinet and wall-mounted supply unit at rear-right.
    box("supply_cabinet",.78,1.25,.48,2.55,.72,-1.88,white);
    box("supply_cabinet_top",.84,.08,.54,2.55,1.37,-1.88,trim);
    for(var k=0;k<3;k++) box("cabinet_drawer_"+k,.70,.025,.035,2.55,.48+k*.28,-1.60,trim);
    box("wall_supply_unit",.58,.48,.14,-2.20,1.55,-2.30,dark);
    box("wall_supply_screen",.42,.28,.025,-2.20,1.57,-2.21,glass);

    scene.add(room);
    // Preserve existing camera controller-free scene; frame bed and room from a wider angle.
    camera.fov=56;
    camera.position.set(0,2.35,4.55);
    camera.lookAt(0,.78,-.30);
    camera.updateProjectionMatrix();
    var w=Math.max(viewport.clientWidth,1),h=Math.max(viewport.clientHeight,1);
    camera.aspect=w/h;camera.updateProjectionMatrix();
    renderer.setClearColor(0x17212b,1);
    renderer.setSize(w,h,false);
    renderer.render(scene,camera);
    console.info("[MedGen 3D] Full Code room v4 attached to active clinical scene.");
    return true;
  }
  global.MedGenVitals3D=Object.freeze({apply:apply});
})(window);
