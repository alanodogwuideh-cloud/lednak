import { db } from 'hatchable';
export const access='public';
export const methods=['GET'];

export default async function(req,res){
 try{
  const [settingsRows,projectRows,branding] = await Promise.all([
   db.query('SELECT * FROM portfolio_settings ORDER BY updated_at DESC LIMIT 1'),
   db.query("SELECT * FROM case_studies WHERE status='published' ORDER BY sort_order ASC,created_at ASC"),
   db.query('SELECT favicon_key,updated_at FROM site_branding ORDER BY updated_at DESC LIMIT 1')
  ]);
  const a=settingsRows.rows[0]||null;
  const settings=a?{
   site_name:a.site_name||'Alan Odogwuideh',role:a.role||'UX Designer',intro:a.intro||'',about_text:a.about_text||'',location:a.location||'Abuja, Nigeria',linkedin_url:a.linkedin_url||'',email:a.email||'',about_image_url:a.about_image_url?'/api/about-image?v='+encodeURIComponent(a.updated_at||Date.now()):'',favicon_url:branding.rows[0]?.favicon_key?'/api/favicon':'',favicon_updated_at:branding.rows[0]?.updated_at||''
  }:{favicon_url:branding.rows[0]?.favicon_key?'/api/favicon':''};
  res.json({settings,projects:projectRows.rows.map(p=>({...p,short_description:p.description||p.subtitle||'',overview:p.description||'',status:p.status||'draft',published:p.status==='published',featured:false,display_order:p.sort_order}))});
 }catch(error){console.error('portfolio error',error.message);res.status(502).json({error:'Portfolio data is temporarily unavailable.'});}
}