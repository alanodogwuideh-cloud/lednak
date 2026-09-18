function renderPresentationStylesSection(b){
  const subs=Array.isArray(b.metadata?.presentation_subsections)?b.metadata.presentation_subsections:[];
  const layout=String(b.metadata?.presentation_layout||'grid')==='list'?'list':'grid';
  const columns=[2,3,4].includes(Number(b.metadata?.presentation_columns))?Number(b.metadata.presentation_columns):2;
  const items=subs.map(sub=>{
    const image=sub?.image||null;
    const style=['card1','card2','card3','card4','card5','analytic_card'].includes(String(sub?.presentation_style))?String(sub.presentation_style):'card1';
    const imageMarkup=image?renderImages([image],{desktop:1,tablet:1,mobile:1},'normal'):'';
    return '<article class="presentation-subsection presentation-style-'+esc(style)+'"><div class="presentation-subsection-content"><h3 class="presentation-subsection-title">'+esc(sub?.title||'')+'</h3>'+(sub?.description?'<p class="presentation-subsection-description">'+esc(sub.description)+'</p>':'')+imageMarkup+'</div></article>';
  }).join('');
  return '<div class="presentation-styles presentation-layout-'+layout+' presentation-columns-'+columns+'">'+items+'</div>';
}