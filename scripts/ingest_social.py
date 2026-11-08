import json,os,pathlib,re,datetime
path=pathlib.Path("public/social-posts.json")
data=json.loads(path.read_text()) if path.exists() else {"posts":[]}
posts=data.get("posts",[])
source=os.environ["POST_SOURCE"].strip().lower()
if source not in ("facebook","instagram"):raise ValueError("Invalid source")
post_id=os.environ["POST_ID"].strip()
if not post_id:raise ValueError("Post ID required")
body=os.environ.get("POST_TEXT","").strip()
image=os.environ.get("POST_IMAGE_URL","").strip()
url=os.environ.get("POST_URL","").strip()
date=os.environ.get("POST_DATE","").strip() or datetime.datetime.now(datetime.timezone.utc).isoformat()
if not body and not image:raise ValueError("No content")
def category(s):
 s=s.lower()
 if re.search(r"\\b(u8|u10|u12|u14|under 8|under 10|under 12|under 14|juniors?)\\b",s):return "Juniors"
 if re.search(r"ladies.{0,18}(1st|first|1s)",s):return "Ladies 1st Team"
 if re.search(r"ladies.{0,18}(development|dev)",s):return "Ladies Development"
 if re.search(r"men.{0,18}(2nd|second|2s)",s):return "Mens 2nd Team"
 if re.search(r"men.{0,18}(1st|first|1s)",s):return "Mens 1st Team"
 if re.search(r"fixture|result|match|goal|league",s):return "Match reports"
 return "Club news"
entry={"id":source+":"+post_id,"source":source,"text":body[:8000],"date":date,"category":category(body),"url":url,"image":image}
posts=[p for p in posts if p.get("id")!=entry["id"]]
posts.insert(0,entry)
posts=sorted(posts,key=lambda p:p.get("date",""),reverse=True)[:100]
path.write_text(json.dumps({"updated":datetime.datetime.now(datetime.timezone.utc).isoformat(),"posts":posts},indent=2,ensure_ascii=False)+"\n")
print("Ingested",entry["id"],entry["category"])
