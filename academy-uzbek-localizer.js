/* MedGen AI — dynamic academy Uzbek/Latin terminology normalizer. */
(function () {
  "use strict";
  var phraseRules = [
    [/Which evidence hierarchy principle applies/gi, "Dalillar ierarxiyasining qaysi tamoyili qo‘llanadi"],
    [/Explain the main mechanism/gi, "Asosiy mexanizmni tushuntiring"]
  ];
  var terms = {
    "skull":"Bosh suyagi — Cranium",
    "frontal bone":"Peshona suyagi — Os frontale",
    "parietal bone":"Tepa suyagi — Os parietale",
    "temporal bone":"Chakka suyagi — Os temporale",
    "occipital bone":"Ensa suyagi — Os occipitale",
    "sphenoid bone":"Asosiy suyak — Os sphenoidale",
    "ethmoid bone":"G‘alvirsimon suyak — Os ethmoidale",
    "mandible":"Pastki jag‘ suyagi — Mandibula",
    "maxilla":"Yuqori jag‘ suyagi — Maxilla",
    "clavicle":"O‘mrov suyagi — Clavicula",
    "scapula":"Kurak suyagi — Scapula",
    "sternum":"To‘sh suyagi — Sternum",
    "humerus":"Yelka suyagi — Humerus",
    "radius":"Bilak suyagi — Radius",
    "ulna":"Tirsak suyagi — Ulna",
    "femur":"Son suyagi — Femur",
    "patella":"Tizza qopqog‘i — Patella",
    "tibia":"Katta boldir suyagi — Tibia",
    "fibula":"Kichik boldir suyagi — Fibula",
    "pelvis":"Chanoq suyagi — Pelvis",
    "vertebra":"Umurtqa — Vertebra"
  };
  function normalize(text) {
    var value = text;
    phraseRules.forEach(function (rule) { value = value.replace(rule[0], rule[1]); });
    var key = value.trim().toLowerCase();
    if (terms[key]) value = value.replace(value.trim(), terms[key]);
    return value;
  }
  function scan(root) {
    if (!root || (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11)) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var parent = node.parentElement;
      if (!parent || /^(SCRIPT|STYLE|TEXTAREA|INPUT|PRE|CODE)$/i.test(parent.tagName)) return;
      var next = normalize(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    });
  }
  function start() {
    scan(document.body);
    var observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        if (record.type === "characterData") {
          var node = record.target, parent = node.parentElement;
          if (parent && !/^(SCRIPT|STYLE|TEXTAREA|INPUT|PRE|CODE)$/i.test(parent.tagName)) {
            var next = normalize(node.nodeValue);
            if (next !== node.nodeValue) node.nodeValue = next;
          }
        }
        if (record.addedNodes) record.addedNodes.forEach(function (node) { if (node.nodeType === 1) scan(node); });
      });
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
