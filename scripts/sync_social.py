import os,json,urllib.request,datetime,pathlib,re
ROOT=pathlib.Path("public"); OUT=ROOT/"social-posts.json"
def get(url,token):
 req=urllib.request.Request(url,headers={"Authorization":"Bearer "+token})
 with urllib.request.urlopen(req,timeout=25) as r:return json.load(r)
def classify(s):
 s=s.lower()
 if re.search(r"\b(u8|under 8|u10|under 10|u12|under 12|u14|under 14|junior|festival)\b",s):return "Juniors"
 if re.search(r"ladies.{0,12}(1st|first|m1|1s)",s):return "Ladies 1st Team"
 if re.search(r"ladies.{0,15}(dev|development)",s):return "Ladies Development"
 if re.search(r"men.{0,12}(2nd|second|m2|2s)",s):return "Mens 2nd Team"
 if re.search(r"men.{0,12}(1st|first|m1|1s)",s):return "Mens 1st Team"
 if re.search(r"fixture|result|match|goal|league",s):return "Match reports"
 return "Club news"
def post(item,source):
 msg=item.get("message") or item.get("caption") or ""
 media=item.get("full_picture") or item.get("media_url") or item.get("thumbnail_url")
 link=item.get("permalink_url") or item.get("permalink") or ""
 if not msg.strip() and not media:return None
 return dict(id=source+":"+str(item["id"]),source=source,text=msg[:8000],date=item.get("created_time") or item.get("timestamp") or "",category=classify(msg),url=link,image=media)
existing=[]
if OUT.exists():
 try:existing=json.loads(OUT.read_text()).get("posts",[])
 except Exception:pass
posts={p["id"]:p for p in existing}
fb=os.getenv("FACEBOOK_PAGE_TOKEN"); page=os.getenv("FACEBOOK_PAGE_ID")
ig=os.getenv("INSTAGRAM_ACCESS_TOKEN") or fb; igid=os.getenv("INSTAGRAM_USER_ID")
if fb and page:
 from urllib.parse import urlencode
 u="https://graph.facebook.com/v24.0/"+page+"/posts?"+urlencode({"fields":"id,message,created_time,permalink_url,full_picture","limit":30})
 for item in get(u,fb).get("data",[]):
  p=post(item,"facebook")
  if p:posts[p["id"]]=p
if ig and igid:
 from urllib.parse import urlencode
 u="https://graph.facebook.com/v24.0/"+igid+"/media?"+urlencode({"fields":"id,caption,timestamp,permalink,media_url,thumbnail_url,media_type","limit":30})
 for item in get(u,ig).get("data",[]):
  p=post(item,"instagram")
  if p:posts[p["id"]]=p
if not ((fb and page) or (ig and igid)):
 print("No Meta credentials configured; leaving existing feed unchanged.")
else:
 ordered=sorted(posts.values(),key=lambda p:p["date"],reverse=True)[:100]
 OUT.write_text(json.dumps({"updated":datetime.datetime.now(datetime.timezone.utc).isoformat(),"posts":ordered},ensure_ascii=False,indent=2)+"\n")
 print("Saved",len(ordered),"social posts")
