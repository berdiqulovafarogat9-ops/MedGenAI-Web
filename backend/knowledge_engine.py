from __future__ import annotations
import re
from collections import defaultdict
from typing import Any

BIOMEDICAL_RELATIONS = {
    "causes","associated_with","targets","inhibits","activates",
    "expressed_in","participates_in","treats","biomarker_of",
    "interacts_with","belongs_to","has_variant"
}

def normalize_entity(name: str) -> str:
    return re.sub(r"\s+", " ", (name or "").strip()).lower()

def make_entity(name: str, entity_type: str="concept", source: str="user") -> dict:
    clean=(name or "").strip()
    return {"id": normalize_entity(clean), "name": clean, "type": (entity_type or "concept").strip(), "source": source}

def make_relation(subject: str, relation: str, object_: str, source: str="user", evidence: str="") -> dict:
    rel=relation.strip().lower().replace(" ","_")
    if rel not in BIOMEDICAL_RELATIONS:
        raise ValueError("Unsupported biomedical relation")
    return {
        "subject": normalize_entity(subject),
        "relation": rel,
        "object": normalize_entity(object_),
        "source": source,
        "evidence": evidence.strip()
    }

def search_graph(entities: list[dict], relations: list[dict], query: str, limit: int=25) -> dict:
    terms=[x for x in re.findall(r"[a-z0-9][a-z0-9_-]{2,}", query.lower())]
    scored=[]
    for e in entities:
        text=(e.get("name","")+" "+e.get("type","")).lower()
        score=sum(1 for t in terms if t in text)
        if score: scored.append((score,e))
    scored.sort(key=lambda x:(x[0],x[1].get("name","")), reverse=True)
    matched={e["id"] for _,e in scored[:limit]}
    rels=[r for r in relations if r.get("subject") in matched or r.get("object") in matched]
    return {"query":query,"entities":[e for _,e in scored[:limit]],"relations":rels[:limit*3]}

def neighborhood(entities: list[dict], relations: list[dict], entity: str, hops: int=2) -> dict:
    root=normalize_entity(entity)
    seen={root}
    frontier={root}
    for _ in range(max(1,min(hops,4))):
        nxt=set()
        for r in relations:
            if r["subject"] in frontier: nxt.add(r["object"])
            if r["object"] in frontier: nxt.add(r["subject"])
        nxt-=seen
        seen|=nxt
        frontier=nxt
    nodes=[e for e in entities if e.get("id") in seen]
    edges=[r for r in relations if r.get("subject") in seen and r.get("object") in seen]
    return {"entity":root,"hops":hops,"entities":nodes,"relations":edges}

def validate_graph(entities: list[dict], relations: list[dict]) -> list[str]:
    ids={e.get("id") for e in entities}
    errors=[]
    for r in relations:
        if r.get("subject") not in ids: errors.append("Missing subject: "+str(r.get("subject")))
        if r.get("object") not in ids: errors.append("Missing object: "+str(r.get("object")))
        if r.get("relation") not in BIOMEDICAL_RELATIONS: errors.append("Unsupported relation: "+str(r.get("relation")))
    return errors

def graph_stats(entities: list[dict], relations: list[dict]) -> dict:
    types=defaultdict(int); reltypes=defaultdict(int)
    for e in entities: types[e.get("type","concept")]+=1
    for r in relations: reltypes[r.get("relation","unknown")]+=1
    return {"entities":len(entities),"relations":len(relations),"entity_types":dict(types),"relation_types":dict(reltypes)}

def find_paths(entities: list[dict], relations: list[dict], start: str, end: str, max_hops: int=4) -> list[list[str]]:
    s,e=normalize_entity(start),normalize_entity(end)
    adj=defaultdict(list)
    for r in relations:
        adj[r["subject"]].append((r["object"],r["relation"]))
        adj[r["object"]].append((r["subject"],r["relation"]))
    queue=[[s]]; paths=[]
    while queue and len(paths)<25:
        path=queue.pop(0); node=path[-1]
        if node==e:
            paths.append(path); continue
        if len(path)-1>=max_hops: continue
        for nxt,_rel in adj.get(node,[]):
            if nxt not in path: queue.append(path+[nxt])
    return paths
