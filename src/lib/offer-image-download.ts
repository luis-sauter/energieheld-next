export function offerImageDownloadName(value:unknown,extension:string,id:string) {
 const name=typeof value==='string'?value.replace(/[^a-zA-Z0-9äöüÄÖÜß._ -]/g,'_').replace(/^[. _-]+/,''):'';
 const matches=extension==='jpg'?/\.jpe?g$/i:new RegExp(`\\.${extension}$`,'i');
 if(name&&name.length<=120&&matches.test(name))return name;
 const stem=name.replace(/\.[^.]*$/,'').slice(0,100);
 return stem?`${stem}.${extension}`:`Banner-${id}.${extension}`;
}
