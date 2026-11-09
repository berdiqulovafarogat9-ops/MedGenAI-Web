/* MedGen AI — Full Code style clinical room, attached to the existing simulator scene.
   Reuses the live renderer/camera/scene; never creates a second canvas, patient or RAF. */
(function (global) {
  "use strict";
  function apply(scene, camera, renderer, viewport) {
    if (!global.THREE || !scene || !camera || !renderer || !viewport) return false;
    if (scene.getObjectByName("medgen_fullcode_room_v5")) return true;
    var previousRoom=scene.getObjectByName("medgen_fullcode_room_v4");
    if(previousRoom) scene.remove(previousRoom);
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

    var room=new T.Group(); room.name="medgen_fullcode_room_v5";
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

    box("bedhead_gas_panel",2.15,.38,.10,-.05,1.94,-2.25,white);
    [[-.72,0x16a34a],[-.24,0xf59e0b],[.24,0x0284c7],[.72,0xe5e7eb]].forEach(function(v){
      var socket=new T.Mesh(new T.CylinderGeometry(.065,.065,.045,24),new T.MeshStandardMaterial({color:v[1],metalness:.22,roughness:.38}));
      socket.rotation.x=Math.PI/2;socket.position.set(v[0],1.94,-2.17);room.add(socket);
      var center=new T.Mesh(new T.CircleGeometry(.027,20),new T.MeshBasicMaterial({color:0x17212b}));
      center.position.set(v[0],1.94,-2.135);room.add(center);
    });
    var lampHub=new T.Mesh(new T.CylinderGeometry(.16,.16,.12,24),trim);lampHub.position.set(.65,3.02,-.1);room.add(lampHub);
    var lampArm=new T.Mesh(new T.CylinderGeometry(.035,.035,1.0,16),trim);lampArm.rotation.z=-.48;lampArm.position.set(.34,2.72,-.05);room.add(lampArm);
    var lampHead=new T.Mesh(new T.CylinderGeometry(.34,.42,.13,32),white);lampHead.position.set(.02,2.36,.02);room.add(lampHead);
    var lampLens=new T.Mesh(new T.CircleGeometry(.31,32),new T.MeshBasicMaterial({color:0xf8fafc}));lampLens.rotation.x=-Math.PI/2;lampLens.position.set(.02,2.285,.02);room.add(lampLens);
    var examSpot=new T.SpotLight(0xeaf6ff,1.35,5,Math.PI/5,.45,1.2);examSpot.position.set(.02,2.28,.02);examSpot.target.position.set(0,.55,.15);room.add(examSpot);room.add(examSpot.target);
    var ivPole=new T.Mesh(new T.CylinderGeometry(.018,.022,2.05,14),trim);ivPole.position.set(1.38,1.05,.35);room.add(ivPole);
    var ivBase=new T.Mesh(new T.CylinderGeometry(.28,.28,.055,24),dark);ivBase.position.set(1.38,.06,.35);room.add(ivBase);
    for(var iw=0;iw<4;iw++){var ivWheel=new T.Mesh(new T.SphereGeometry(.055,12,10),trim);ivWheel.position.set(1.38+Math.cos(iw*Math.PI/2)*.22,.045,.35+Math.sin(iw*Math.PI/2)*.22);room.add(ivWheel);}
    var ivBag=new T.Mesh(new T.BoxGeometry(.20,.30,.07),glass);ivBag.position.set(1.38,2.02,.35);room.add(ivBag);
    var ivFluid=new T.Mesh(new T.BoxGeometry(.16,.13,.012),new T.MeshBasicMaterial({color:0x38bdf8,transparent:true,opacity:.5}));ivFluid.position.set(1.38,1.96,.307);room.add(ivFluid);
    box("crash_cart_body",.68,.82,.48,-1.65,.48,-.52,new T.MeshStandardMaterial({color:0xb91c1c,roughness:.48,metalness:.08}));
    for(var dr=0;dr<4;dr++){box("crash_cart_drawer_"+dr,.58,.13,.025,-1.65,.23+dr*.19,-.265,white);box("crash_cart_handle_"+dr,.24,.025,.025,-1.65,.23+dr*.19,-.235,trim);}
    box("crash_cart_top",.74,.07,.52,-1.65,.92,-.52,trim);
    box("defibrillator_body",.34,.18,.28,-1.65,1.045,-.52,dark);
    box("defibrillator_screen",.23,.11,.018,-1.65,1.055,-.365,new T.MeshBasicMaterial({color:0x0f766e}));
    var blanket=new T.Mesh(new T.BoxGeometry(.78,.12,1.02),new T.MeshStandardMaterial({color:0x267da5,roughness:.88}));
    blanket.name="clinical_patient_blanket";blanket.position.set(0,.79,.48);blanket.castShadow=true;room.add(blanket);

    box("door_frame",.12,2.35,1.12,3.20,1.18,-1.42,trim);
    box("clinical_door",.075,2.22,.98,3.13,1.14,-1.42,new T.MeshStandardMaterial({color:0xb7c8cb,roughness:.78}));
    box("door_vision_glass",.035,.42,.62,3.085,1.78,-1.42,glass);
    box("door_handle",.055,.16,.035,3.04,1.12,-1.12,trim);
    var rail=new T.Mesh(new T.CylinderGeometry(.018,.018,2.5,12),trim);
    rail.rotation.z=Math.PI/2; rail.position.set(0,2.55,.72); room.add(rail);
    var curtainMat=new T.MeshStandardMaterial({color:0x6ca9ba,roughness:.95,transparent:true,opacity:.34,side:T.DoubleSide,depthWrite:false});
    var curtainA=new T.Mesh(new T.PlaneGeometry(.95,1.95),curtainMat);
    curtainA.position.set(-.72,1.55,.72); room.add(curtainA);
    var curtainB=new T.Mesh(new T.PlaneGeometry(.72,1.95),curtainMat);
    curtainB.position.set(.78,1.55,.72); room.add(curtainB);
    for(var seam=-2;seam<=2;seam++){
      var line=new T.Mesh(new T.BoxGeometry(.012,.003,4.8),new T.MeshBasicMaterial({color:0x53616a}));
      line.position.set(seam*1.1,.008,0); room.add(line);
    }
    box("ceiling_exam_light",1.65,.055,.48,0,3.08,-.25,white);
    var ceilingGlow=new T.PointLight(0xe4f4ff,1.15,7);
    ceilingGlow.position.set(0,2.95,.25); room.add(ceilingGlow);


    // Portable ultrasound cart — educational visualization only (not a diagnostic scanner).
    var usBaseMat=new T.MeshStandardMaterial({color:0xe7edf0,roughness:.58,metalness:.12});
    var usScreenMat=new T.MeshStandardMaterial({color:0x101a24,roughness:.3,metalness:.12});
    box("ultrasound_cart_column",.10,.74,.10,2.05,.57,.55,trim);
    box("ultrasound_cart_base",.62,.09,.48,2.05,.13,.55,usBaseMat);
    for(var uw=0;uw<4;uw++){
      var ua=uw*Math.PI/2, wheel=new T.Mesh(new T.TorusGeometry(.065,.018,8,16),dark);
      wheel.rotation.y=Math.PI/2;wheel.position.set(2.05+Math.cos(ua)*.23,.075,.55+Math.sin(ua)*.17);room.add(wheel);
    }
    box("ultrasound_console",.66,.12,.40,2.05,1.00,.55,usBaseMat);
    box("ultrasound_monitor_shell",.72,.54,.10,2.05,1.40,.43,dark);
    var usCanvas=document.createElement("canvas");usCanvas.width=512;usCanvas.height=384;
    var ux=usCanvas.getContext("2d");
    ux.fillStyle="#07131d";ux.fillRect(0,0,512,384);
    ux.fillStyle="#9bd7e8";ux.font="bold 22px sans-serif";ux.fillText("UZI · O‘QUV DEMO",18,34);
    ux.fillStyle="#647987";ux.font="15px sans-serif";ux.fillText("Haqiqiy diagnostik tasvir emas",18,58);
    ux.save();ux.beginPath();ux.moveTo(256,82);ux.lineTo(78,350);ux.lineTo(434,350);ux.closePath();ux.clip();
    for(var uy=0;uy<270;uy+=3){for(var ux2=0;ux2<360;ux2+=3){
      var noise=(Math.sin(ux2*12.989+uy*78.233)*43758.5453)%1;
      var alpha=Math.abs(noise)*.28;
      ux.fillStyle="rgba(185,220,230,"+alpha+")";ux.fillRect(76+ux2,82+uy,2,2);
    }}
    ux.strokeStyle="rgba(123,190,210,.55)";ux.lineWidth=2;
    ux.beginPath();ux.moveTo(256,95);ux.quadraticCurveTo(180,180,155,330);ux.stroke();
    ux.beginPath();ux.moveTo(256,95);ux.quadraticCurveTo(332,180,357,330);ux.stroke();
    ux.restore();
    var usTexture=new T.CanvasTexture(usCanvas);
    var usScreen=new T.Mesh(new T.PlaneGeometry(.62,.43),new T.MeshBasicMaterial({map:usTexture}));
    usScreen.position.set(2.05,1.40,.486);room.add(usScreen);
    box("ultrasound_probe_holder",.13,.09,.16,2.43,1.02,.50,trim);
    var probe=new T.Mesh(new T.SphereGeometry(.07,14,10),new T.MeshStandardMaterial({color:0x273746,roughness:.4}));
    probe.scale.set(.72,1.4,.7);probe.position.set(2.43,1.13,.50);room.add(probe);
    var probeCable=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([
      new T.Vector3(2.43,1.12,.5),new T.Vector3(2.58,.95,.62),new T.Vector3(2.48,.78,.70),new T.Vector3(2.28,.82,.62)
    ]),24,.012,6,false),new T.MeshStandardMaterial({color:0x263746}));
    room.add(probeCable);
    // Generic clinician training mannequin at bedside; no real-person identity.
    var staff=new T.Group();staff.name="clinical_staff_training_mannequin";staff.position.set(-2.45,0,.42);
    var scrubs=new T.MeshStandardMaterial({color:0x167c83,roughness:.88});
    var skin=new T.MeshStandardMaterial({color:0xc99578,roughness:.9});
    function staffPart(geo,mat,x,y,z,sx,sy,sz){var m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;staff.add(m);return m;}
    staffPart(new T.CapsuleGeometry(.22,.62,5,10),scrubs,0,1.02,0,1,1,.72);
    staffPart(new T.SphereGeometry(.16,18,14),skin,0,1.62,.015,1,1,1);
    staffPart(new T.BoxGeometry(.10,.24,.025),white,0,1.12,.17,1,1,1);
    [-1,1].forEach(function(side){
      var arm=staffPart(new T.CapsuleGeometry(.075,.43,4,8),scrubs,side*.29,1.05,.02,1,1,1);arm.rotation.z=side*.24;
      staffPart(new T.SphereGeometry(.065,12,10),skin,side*.36,.76,.07,1,1,1);
      staffPart(new T.CylinderGeometry(.07,.085,.72,12),dark,side*.12,.36,0,1,1,1);
      staffPart(new T.BoxGeometry(.16,.08,.30),dark,side*.12,.055,.06,1,1,1);
    });
    scene.add(staff);

    scene.add(room);
    // Preserve existing camera controller-free scene; frame bed and room from a wider angle.
    camera.fov=48;
    camera.position.set(3.45,2.65,5.35);
    camera.lookAt(0,.92,-.38);
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
