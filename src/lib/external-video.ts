// Only canonical provider identities; no raw embed HTML.
export function externalVideoEmbed(value: string): string | undefined {
 const youtube=/^https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})$/.exec(value);
 if(youtube)return `https://www.youtube-nocookie.com/embed/${youtube[1]}?autoplay=0`;
 const vimeo=/^https:\/\/vimeo\.com\/([0-9]{1,20})$/.exec(value);
 return vimeo?`https://player.vimeo.com/video/${vimeo[1]}?autoplay=0`:undefined;
}
