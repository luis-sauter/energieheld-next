export function EditorialIcon({ kind }: { kind: "profile" | "advertising" | "verification" | "content" }) {
 const paths={profile:"M4 21V3h12v18M8 7h4M8 11h4M8 15h4M2 21h20M18 9h3v12",advertising:"M3 5h18v14H3zM7 9h10M7 13h6",verification:"m12 3 8 4v6c0 4-8 8-8 8s-8-4-8-8V7l8-4Zm-4 9 3 3 5-6",content:"M5 3h10l4 4v14H5zM9 11h6M9 15h6"};
 return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]}/></svg>;
}
