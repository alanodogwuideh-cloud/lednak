(() => {
  const root = document.getElementById('resumeStudioApp');
  if (!root) return;

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2));
  function confirmDialog(message, options = {}) {
    return new Promise(resolve => {
      document.querySelector('.rs-confirm-backdrop')?.remove();
      const danger = options.tone === 'danger' || /delete|remove|replace|discard|cannot be undone/i.test(message);
      const title = options.title || (danger ? 'Confirm this action' : 'Are you sure?');
      const confirmLabel = options.confirmLabel || (danger ? 'Continue' : 'Confirm');
      const overlay = document.createElement('div');
      overlay.className = 'rs-confirm-backdrop';
      overlay.innerHTML = '<section class="rs-confirm-modal '+(danger?'is-danger':'is-neutral')+'" role="alertdialog" aria-modal="true" aria-labelledby="rsConfirmTitle" aria-describedby="rsConfirmMessage" tabindex="-1"><div class="rs-confirm-icon" aria-hidden="true">'+(danger?'!':'?')+'</div><h3 id="rsConfirmTitle">'+escHtml(title)+'</h3><p id="rsConfirmMessage">'+escHtml(message)+'</p><div class="rs-confirm-actions"><button type="button" class="secondary" data-confirm-choice="cancel">Cancel</button><button type="button" class="'+(danger?'danger':'primary')+'" data-confirm-choice="confirm">'+escHtml(confirmLabel)+'</button></div></section>';
      const finish = value => { if (!overlay.isConnected) return; overlay.remove(); document.removeEventListener('keydown', onKey); resolve(value); };
      const onKey = event => { if(event.key === 'Escape'){event.preventDefault();finish(false);} };
      overlay.addEventListener('click', event => { const choice=event.target.closest('[data-confirm-choice]'); if(choice) finish(choice.dataset.confirmChoice === 'confirm'); else if(event.target === overlay) finish(false); });
      document.addEventListener('keydown', onKey); document.body.appendChild(overlay); overlay.querySelector('[data-confirm-choice="confirm"]')?.focus();
    });
  }
  const emptyProfile = () => ({
    contact: { fullName: '', email: '', phone: '', location: '', links: [] },
    summaries: [], experience: [], projects: [], skills: [], education: [], certifications: []
  });
  let profile = emptyProfile();
  let savedJson = JSON.stringify(profile);
  let loaded = false;
  let loading = false;
  let saving = false;
  let lastSavedAt = null;
  let saveError = '';
  let openAfterRender = '';
  let activeView = 'profile';
  let resumeEditorStep = 0;
  let resumeEditorResumeId = null;
  let resumePreviewMode = false;
  let importBusy = false;
  let importStage = 'Preparing your resume…';
  let importReview = null;
  let importError = '';
  const draftKey = 'resume-studio-master-profile-draft-v1';
  function persistLocalDraft() {
    try {
      const value = JSON.stringify({ profile, savedJson, savedAt: new Date().toISOString() });
      if (value.length <= 250000) localStorage.setItem(draftKey, value);
    } catch (_) { /* Storage may be unavailable; server save remains authoritative. */ }
  }
  function clearLocalDraft() {
    try { localStorage.removeItem(draftKey); } catch (_) {}
  }
  function readLocalDraft() {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return null;
      const draft = JSON.parse(raw);
      return draft && draft.profile && typeof draft.profile === 'object' ? draft : null;
    } catch (_) { return null; }
  }
  const escHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const clean = value => String(value ?? '');
  const splitTags = value => clean(value).split(',').map(item => item.trim()).filter(Boolean).slice(0, 100);
  const formatSaved = value => {
    if (!value) return 'Not saved yet';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Saved' : 'Saved at ' + date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  };
  const getPath = path => path.split('.').reduce((value, key) => value == null ? undefined : value[key], profile);
  const setPath = (path, value) => {
    const parts = path.split('.');
    let target = profile;
    for (const key of parts.slice(0, -1)) target = target[key];
    target[parts[parts.length - 1]] = value;
  };
  const field = (path, label, value, options = {}) => {
    const kind = options.kind || 'text';
    const max = options.max || 500;
    const placeholder = options.placeholder ? ' placeholder="' + escHtml(options.placeholder) + '"' : '';
    if (kind === 'textarea') return '<label class="rs-field ' + (options.wide ? 'rs-wide' : '') + '"><span>' + escHtml(label) + '</span><textarea data-path="' + escHtml(path) + '" maxlength="' + max + '"' + placeholder + ' rows="' + (options.rows || 3) + '">' + escHtml(value) + '</textarea>' + (options.hint ? '<small>' + escHtml(options.hint) + '</small>' : '') + '</label>';
    return '<label class="rs-field ' + (options.wide ? 'rs-wide' : '') + '"><span>' + escHtml(label) + '</span><input data-path="' + escHtml(path) + '" type="' + (kind === 'email' || kind === 'url' || kind === 'tel' ? kind : 'text') + '" maxlength="' + max + '" value="' + escHtml(value) + '"' + placeholder + '>' + (options.hint ? '<small>' + escHtml(options.hint) + '</small>' : '') + '</label>';
  };
  const check = (path, label, checked) => '<label class="rs-check"><input type="checkbox" data-path="' + escHtml(path) + '"' + (checked ? ' checked' : '') + '><span>' + escHtml(label) + '</span></label>';
  const actions = (group, index, length) => '<div class="rs-card-actions"><button type="button" class="rs-icon-action" data-action="move-' + group + '" data-index="' + index + '" data-dir="up" aria-label="Move up" title="Move up"' + (index === 0 ? ' disabled' : '') + '>↑</button><button type="button" class="rs-icon-action" data-action="move-' + group + '" data-index="' + index + '" data-dir="down" aria-label="Move down" title="Move down"' + (index === length - 1 ? ' disabled' : '') + '>↓</button><button type="button" class="rs-remove" data-action="remove-' + group + '" data-index="' + index + '">Remove</button></div>';
  const bulletEditor = (group, parentIndex, bullets) => '<div class="rs-bullets"><div class="rs-subhead"><div><strong>Achievement bullets</strong><p>Use one clear, evidence-backed statement per bullet.</p></div><button type="button" class="rs-small-button" data-action="add-bullet" data-group="' + group + '" data-parent-index="' + parentIndex + '">+ Add bullet</button></div>' +
    (bullets.length ? bullets.map((bullet, i) => '<div class="rs-bullet-row"><div class="rs-bullet-number">' + (i + 1) + '</div><div class="rs-bullet-fields"><textarea data-path="' + group + '.' + parentIndex + '.bullets.' + i + '.text" rows="2" maxlength="2000" placeholder="Describe the action, scope, and outcome.">' + escHtml(bullet.text) + '</textarea><label class="rs-field"><span>Evidence tags (comma-separated, optional)</span><input data-path="' + group + '.' + parentIndex + '.bullets.' + i + '.tags" data-kind="csv" value="' + escHtml((bullet.tags || []).join(', ')) + '" placeholder="research, prototyping, payments"></label></div><div class="rs-bullet-actions"><button type="button" class="rs-icon-action" data-action="move-bullet" data-group="' + group + '" data-parent-index="' + parentIndex + '" data-index="' + i + '" data-dir="up" aria-label="Move bullet up"' + (i === 0 ? ' disabled' : '') + '>↑</button><button type="button" class="rs-icon-action" data-action="move-bullet" data-group="' + group + '" data-parent-index="' + parentIndex + '" data-index="' + i + '" data-dir="down" aria-label="Move bullet down"' + (i === bullets.length - 1 ? ' disabled' : '') + '>↓</button><button type="button" class="rs-remove" data-action="remove-bullet" data-group="' + group + '" data-parent-index="' + parentIndex + '" data-index="' + i + '">Remove</button></div></div>').join('') : '<p class="rs-empty-inline">No bullets yet. Add one when you are ready.</p>') + '</div>';
  const section = (key, title, description, content, isOpen) => '<details class="rs-section" data-section="' + key + '"' + (isOpen ? ' open' : '') + '><summary><span class="rs-section-summary"><strong>' + title + '</strong><small>' + description + '</small></span><span class="rs-chevron" aria-hidden="true"><img src="/admin/chevron-down.svg" alt="" width="24" height="24"></span></summary><div class="rs-section-body">' + content + '</div></details>';
  const emptyState = text => '<div class="rs-empty-inline">' + escHtml(text) + '</div>';
  function currentOpenSections() {
    return new Set([...root.querySelectorAll('details.rs-section[open]')].map(node => node.dataset.section));
  }
  let resumeRows = [];
  let currentResume = null;
  let resumeSavedJson = '';
  let resumeLoading = false;
  let resumeSaving = false;
  let resumeMessage = '';
  let resumeSavedTitle = '';
  let resumeAnalysis = null;
  let resumeAnalysisOpen = false;
  let resumeAnalysisTab = 'analysis';
  let resumeSuggestions = [];
  let resumeSuggestionError = '';
  let resumeJobSuggestions = [];
  let resumeJobDescription = '';
  let resumeJobSuggestionsLoading = false;
  let resumeSuggestionMode = 'general';
  let resumeSuggestionsLoading = false;
  const resumeReviewKey = id => 'resume-studio-review-v1:' + String(id || '');
  function persistResumeReview() {
    if (!currentResume?.id) return;
    try {
      const state = { analysis:resumeAnalysis, analysisTab:resumeAnalysisTab, suggestions:resumeSuggestions, jobSuggestions:resumeJobSuggestions, jobDescription:resumeJobDescription, suggestionMode:resumeSuggestionMode, savedAt:new Date().toISOString() };
      const value = JSON.stringify(state);
      if (value.length <= 100000) localStorage.setItem(resumeReviewKey(currentResume.id), value);
    } catch (_) { /* Review persistence is best-effort if browser storage is unavailable. */ }
  }
  function restoreResumeReview(id) {
    resumeAnalysis=null; resumeAnalysisOpen=false; resumeAnalysisTab='analysis'; resumeSuggestions=[]; resumeJobSuggestions=[]; resumeJobDescription=''; resumeSuggestionMode='general'; resumeSuggestionsLoading=false; resumeJobSuggestionsLoading=false;
    try {
      const raw=localStorage.getItem(resumeReviewKey(id));
      if (!raw) return;
      const state=JSON.parse(raw);
      if (!state || typeof state!=='object') return;
      resumeAnalysis=state.analysis && typeof state.analysis==='object' ? state.analysis : null;
      resumeAnalysisTab=state.analysisTab==='suggestions'?'suggestions':'analysis';
      resumeSuggestions=Array.isArray(state.suggestions)?state.suggestions.slice(0,8):[];
      resumeJobSuggestions=Array.isArray(state.jobSuggestions)?state.jobSuggestions.slice(0,8):[];
      resumeJobDescription=String(state.jobDescription||'').slice(0,20000);
      resumeSuggestionMode=state.suggestionMode==='job'?'job':'general';
      resumeAnalysisOpen=false;
    } catch (_) { /* Ignore malformed cached review data. */ }
  }
  function clearResumeReview(id) {
    try { localStorage.removeItem(resumeReviewKey(id)); } catch (_) {}
  }
  let resumeAnalyzing = false;
  function autoClearResumeMessage(message, delay=12000) {
    setTimeout(() => {
      if(resumeMessage===message) {
        resumeMessage='';
        if(currentResume) renderResumeView();
      }
    }, delay);
  }
  const resumeIsDirty = () => !!currentResume && (JSON.stringify(currentResume.content)!==resumeSavedJson || currentResume.title!==resumeSavedTitle);
  function resumeAnalysisText(resume) {
    const c = resume?.content || {};
    const lines = [resume?.title || 'Resume'];
    const contact = c.contact || {};
    if (contact.fullName) lines.push(contact.fullName);
    lines.push([contact.email,contact.phone,contact.location].filter(Boolean).join(' | '));
    (contact.links || []).forEach(link => { if (link.url) lines.push((link.label ? link.label + ': ' : '') + link.url); });
    if (c.summary) lines.push('PROFESSIONAL SUMMARY\n' + c.summary);
    for (const section of c.sectionOrder || resumeSections) {
      if (section === 'summary' || (c.hiddenSections || []).includes(section)) continue;
      const title = c.sectionTitles?.[section] || resumeSectionNames[section] || section;
      lines.push('\n' + title.toUpperCase());
      for (const item of c[section] || []) {
        if (item.hidden) continue;
        if (section === 'experience') lines.push([item.title,item.company,item.location,[item.startDate,item.endDate || (item.current ? 'Present' : '')].filter(Boolean).join(' - ')].filter(Boolean).join(' | '));
        else if (section === 'projects') lines.push([item.name,item.url,item.description].filter(Boolean).join(' | '));
        else if (section === 'skills') lines.push([item.category,(item.items || []).join(', ')].filter(Boolean).join(': '));
        else if (section === 'education') lines.push([item.degree,item.field,item.institution,item.startDate,item.endDate,item.notes].filter(Boolean).join(' | '));
        else if (section === 'certifications') lines.push([item.name,item.issuer,item.date].filter(Boolean).join(' | '));
        (item.bullets || []).forEach(b => { if (!b.hidden && b.text) lines.push('- ' + b.text); });
      }
    }
    return lines.filter(Boolean).join('\n').slice(0,40000);
  }
  function normalizeResumeAnalysis(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('The analysis service returned an invalid result. Please try again.');
    }
    const list = key => Array.isArray(value[key])
      ? value[key].map(item => String(item ?? '').trim()).filter(Boolean).slice(0, 20)
      : [];
    const normalized = {
      overall_assessment: String(value.overall_assessment ?? '').trim().slice(0, 3000),
      strengths: list('strengths'),
      issues: list('issues'),
      missing_information: list('missing_information'),
      structure_recommendations: list('structure_recommendations'),
      evidence_warnings: list('evidence_warnings'),
      next_steps: list('next_steps')
    };
    const hasContent = normalized.overall_assessment || [
      normalized.strengths, normalized.issues, normalized.missing_information,
      normalized.structure_recommendations, normalized.evidence_warnings, normalized.next_steps
    ].some(items => items.length);
    if (!hasContent) {
      throw new Error('The analysis returned no usable findings. Please try again.');
    }
    return normalized;
  }
  function resumeAnalysisHtml() {
    if (!resumeAnalysis) return '';
    const a = resumeAnalysis;
    const group = (title,items) => Array.isArray(items) && items.length ? '<section class="rs-analysis-group"><h4>'+escHtml(title)+'</h4><ul>'+items.map(x=>'<li>'+escHtml(x)+'</li>').join('')+'</ul></section>' : '';
    const tabs = '<div class="rs-analysis-tabs" role="tablist"><button type="button" role="tab" aria-selected="'+(resumeAnalysisTab==='analysis')+'" class="rs-analysis-tab '+(resumeAnalysisTab==='analysis'?'is-active':'')+'" data-resume-action="analysis-tab" data-tab-value="analysis">Analysis</button><button type="button" role="tab" aria-selected="'+(resumeAnalysisTab==='suggestions')+'" class="rs-analysis-tab '+(resumeAnalysisTab==='suggestions'?'is-active':'')+'" data-resume-action="analysis-tab" data-tab-value="suggestions">Suggestions</button></div>';
    const suggestionsBusy = resumeSuggestionsLoading;
    const suggestionControls = '<button type="button" class="primary" data-resume-action="generate-suggestions" '+(resumeSuggestionsLoading?'disabled':'')+'>'+(resumeSuggestionsLoading?'Generating suggestions…':resumeSuggestions.length?'Generate new suggestions':'Suggest resume fixes')+'</button>';
    const suggestions = resumeSuggestionError ? '<div class="rs-suggestions-error" role="alert"><h4>Suggestions could not be generated</h4><p>'+escHtml(resumeSuggestionError)+'</p><p>Check the service connection and try again. Your saved resume has not been changed.</p></div>' : suggestionsBusy ? '<div class="rs-suggestions-state" role="status"><strong>Generating resume suggestions…</strong><p>Reviewing your resume and analysis to prepare editable examples.</p></div>' : resumeSuggestions.length ? resumeSuggestions.map((item,index)=>'<section class="rs-suggestion-card"><div class="rs-suggestion-card-head"><h4>'+escHtml(item.title||'Suggested improvement')+'</h4><button type="button" class="rs-suggestion-copy" data-resume-action="copy-suggestion" data-index="'+index+'">Copy text</button></div><p>'+escHtml(item.reason||'Example based on the information provided.')+'</p><label class="rs-suggestion-editor"><span>Edit this example before using it</span><textarea rows="5" maxlength="4000" data-suggestion-index="'+index+'">'+escHtml(item.text||'')+'</textarea></label><small>Verify every claim. Replace placeholders with real information and do not claim skills or qualifications you do not have.</small></section>').join('') : '<div class="rs-suggestions-empty"><h4>Improve your resume</h4><p>Generate editable examples based on your resume and analysis. No job description is needed, and your saved resume will not be changed automatically.</p></div>';
    const analysisContent = (a.overall_assessment?'<p class="rs-analysis-assessment">'+escHtml(a.overall_assessment)+'</p>':'')+group('Strengths',a.strengths)+group('Issues to address',a.issues)+group('Missing information to verify',a.missing_information)+group('Structure recommendations',a.structure_recommendations)+group('Evidence warnings',a.evidence_warnings)+group('Recommended next steps',a.next_steps)+'<div class="rs-analysis-generate"><div><strong>Want examples for improving these findings?</strong><p>Generate editable suggestions using your resume details.</p></div><button type="button" class="primary" data-resume-action="generate-suggestions" '+(resumeSuggestionsLoading?'disabled':'')+'>'+(resumeSuggestionsLoading?'Generating…':'Get suggestions')+'</button></div>';
    return '<div class="rs-analysis-backdrop" data-resume-action="close-analysis" data-overlay-backdrop="true"><section class="rs-analysis-modal" role="dialog" aria-modal="true" aria-labelledby="rsAnalysisTitle" aria-describedby="rsAnalysisDescription" tabindex="-1"><header class="rs-analysis-modal-header"><div><span class="eyebrow">RESUME REVIEW</span><h3 id="rsAnalysisTitle">Resume analysis</h3><p id="rsAnalysisDescription">A structured review of your resume content and presentation.</p></div><button type="button" class="rs-analysis-close" data-resume-action="close-analysis" aria-label="Close resume analysis">×</button></header>'+tabs+'<div class="rs-analysis-modal-body">'+(resumeAnalysisTab==='analysis'?analysisContent:'<div class="rs-suggestions-intro"><h4>Resume improvement suggestions</h4><p>Get editable examples based on your resume and analysis. Job-specific suggestions will be considered in a later milestone.</p></div>'+suggestionControls+suggestions)+'<p class="rs-analysis-note">Your resume will not be changed automatically. Verify every claim before using it.</p></div><footer class="rs-analysis-modal-footer"><span>Review the suggestions before editing your resume.</span><button type="button" class="primary" data-resume-action="close-analysis">Close review</button></footer></section></div>';
  }
  const resumeSections = ['summary','experience','projects','skills','education','certifications'];
  const resumeSectionNames = {summary:'Professional Summary',experience:'Experience',projects:'Projects',skills:'Skills',education:'Education',certifications:'Certifications'};
  const rtext = (value, max=500) => String(value ?? '').slice(0,max);
  const rpathGet = (obj,path) => path.split('.').reduce((v,k)=>v==null?undefined:v[k],obj);
  function rpathSet(obj,path,value) { const keys=path.split('.'); let target=obj; for(const key of keys.slice(0,-1)) target=target[key]; target[keys[keys.length-1]]=value; }
  const rfield = (path,label,value,kind='text') => '<label class="rs-field"><span>'+escHtml(label)+'</span>'+(kind==='textarea'?'<textarea data-resume-path="'+escHtml(path)+'" rows="3">'+escHtml(value)+'</textarea>':'<input data-resume-path="'+escHtml(path)+'" value="'+escHtml(value)+'">')+'</label>';
  const rcheck = (path,label,checked) => '<label class="rs-check"><input type="checkbox" data-resume-path="'+escHtml(path)+'"'+(checked?' checked':'')+'><span>'+escHtml(label)+'</span></label>';
  function updateEditorToolbarStickiness() {
    const toolbar = root.querySelector('.rs-editor-toolbar');
    if (!toolbar) return;
    toolbar.classList.toggle('is-stuck', toolbar.getBoundingClientRect().top <= 20);
  }
  function renderResumeView() {
    const dirty = resumeIsDirty();
    const head = '<div class="rs-header"><div><div class="eyebrow">CAREER WORKSPACE</div><h2>Resumes</h2><p class="muted">Create editable resumes from your Master Profile. Each resume is its own saved snapshot.</p></div><button type="button" class="primary" data-resume-action="new">+ New resume</button></div>'+
      '<button type="button" class="rs-mobile-nav-toggle" aria-expanded="false" aria-controls="rsStudioTabs"><span aria-hidden="true">☰</span><span>Resume Studio menu</span></button><div id="rsStudioTabs" class="rs-tabs" role="tablist" aria-label="Resume Studio sections"><button type="button" class="rs-tab" data-resume-view="profile">Master Profile</button><button type="button" class="rs-tab is-active" data-resume-view="resumes" aria-selected="true">Resumes</button><button type="button" class="rs-tab" disabled>Jobs <span>Coming soon</span></button><button type="button" class="rs-tab" disabled>Cover Letters <span>Coming soon</span></button></div>';
    if (resumeLoading && !currentResume) { root.innerHTML=head+'<div class="panel rs-loading"><span class="rs-spinner"></span><p>Loading resumes…</p></div>'; return; }
    if (currentResume) {
      if (resumeEditorResumeId !== currentResume.id) { resumeEditorResumeId=currentResume.id; resumeEditorStep=0; resumePreviewMode=false; }
      const c=currentResume.content||{};
      if (resumePreviewMode) {
        root.innerHTML=head+'<section class="rs-resume-complete"><div class="rs-resume-complete-intro"><span class="rs-resume-complete-mark" aria-hidden="true">✓</span><p class="eyebrow">RESUME CREATION COMPLETE</p><h2>Your resume is ready to preview</h2><p>Review your finished resume below. You can return to your resumes list whenever you are ready.</p></div><div class="rs-resume-complete-toolbar"><button type="button" class="secondary" data-resume-action="back">← Back to resumes</button><span class="rs-resume-save-status">'+escHtml(resumeMessage||(dirty?'Unsaved changes':'Saved'))+'</span><label class="rs-template-picker"><span>Resume template</span><select data-resume-template aria-label="Choose resume template"><option value="t1" '+(c.template==='t1'?'selected':'')+'>T1 · New York</option><option value="t2" '+(c.template==='t2'?'selected':'')+'>T2 · Paris</option><option value="t3" '+(c.template==='t3'?'selected':'')+'>T3 · Toronto</option><option value="t4" '+(c.template==='t4'?'selected':'')+'>T4 · Chicago</option><option value="t5" '+(c.template==='t5'?'selected':'')+'>T5 · Madrid</option><option value="t6" '+(c.template==='t6'?'selected':'')+'>T6 · Santiago</option><option value="t7" '+(c.template==='t7'?'selected':'')+'>T7 · Istanbul</option><option value="t8" '+(c.template==='t8'?'selected':'')+'>T8 · London</option><option value="t9" '+(c.template==='t9'?'selected':'')+'>T9 · Karachi</option><option value="t10" '+(c.template==='t10'?'selected':'')+'>T10 · Mumbai</option><option value="t11" '+(c.template==='t11'?'selected':'')+'>T11 · Delhi</option><option value="t12" '+(c.template==='t12'?'selected':'')+'>T12 · San Francisco</option><option value="t13" '+(c.template==='t13'?'selected':'')+'>T13 · Boston</option><option value="t14" '+(c.template==='t14'?'selected':'')+'>T14 · Seattle</option><option value="t15" '+(c.template==='t15'?'selected':'')+'>T15 · Amsterdam</option><option value="t16" '+(c.template==='t16'?'selected':'')+'>T16 · Singapore</option><option value="t17" '+(c.template==='t17'?'selected':'')+'>T17 · Tokyo</option><option value="t18" '+(c.template==='t18'?'selected':'')+'>T18 · Stockholm</option><option value="t19" '+(c.template==='t19'?'selected':'')+'>T19 · Sydney</option><option value="t20" '+(c.template==='t20'?'selected':'')+'>T20 · São Paulo</option><option value="t21" '+(c.template==='t21'?'selected':'')+'>T21 · Seoul</option><option value="t22" '+(c.template==='t22'?'selected':'')+'>T22 · Berlin</option><option value="t23" '+(c.template==='t23'?'selected':'')+'>T23 · Zurich</option><option value="t24" '+(c.template==='t24'?'selected':'')+'>T24 · Vienna</option><option value="t25" '+(c.template==='t25'?'selected':'')+'>T25 · Mexico City</option><option value="t26" '+(c.template==='t26'?'selected':'')+'>T26 · Dubai</option><option value="t27" '+(c.template==='t27'?'selected':'')+'>T27 · Cape Town</option></select></label><label class="rs-template-picker"><span>Accent</span><input type="color" data-resume-accent value="'+escHtml(c.accent||'#23395B')+'" aria-label="Template accent color"></label><label class="rs-template-picker"><span>Page size</span><select class="rs-template-page-size" data-resume-page-size aria-label="Page size"><option value="letter" '+((c.pageSize||'letter')==='letter'?'selected':'')+'>US Letter</option><option value="a4" '+(c.pageSize==='a4'?'selected':'')+'>A4</option></select></label><div class="rs-resume-complete-actions">'+(dirty?'<button type="button" class="primary" data-resume-action="save" '+(resumeSaving?'disabled':'')+'>'+(resumeSaving?'Saving…':'Save resume')+'</button>':'')+'<button type="button" class="secondary" data-resume-action="print">Download PDF</button></div></div><div class="rs-resume-complete-preview"><div class="rs-preview-label"><span>RESUME PREVIEW</span><span>'+(c.pageSize==='a4'?'A4 · 210 × 297 mm':'US LETTER · 8.5 × 11 in')+'</span></div><div id="rsResumePreview" class="rs-resume-paper rs-template-'+escHtml(c.template||'classic')+'" style="--resume-user-accent:'+escHtml(c.accent||'#23395B')+';--resume-page-size:'+(c.pageSize==='a4'?'210mm 297mm':'8.5in 11in')+'">'+resumePreviewHtml(c)+'</div></div></section>';
        return;
      }
      const editorHeader='<div class="rs-editor-toolbar"><button class="secondary" type="button" data-resume-action="back">← All resumes</button><div class="rs-editor-toolbar-actions"><span class="rs-resume-save-status">'+escHtml(resumeMessage||(dirty?'Unsaved changes':'Saved'))+'</span>'+(resumeAnalysis?'<button class="secondary" type="button" data-resume-action="view-analysis">Resume review</button>':'<button class="secondary" type="button" data-resume-action="analyze" '+(resumeAnalyzing?'disabled':'')+'>'+(resumeAnalyzing?'Analyzing…':'Analyze resume')+'</button>')+'<button class="secondary" type="button" data-resume-action="print">Download PDF</button><button class="primary" type="button" data-resume-action="save" '+(!dirty||resumeSaving?'disabled':'')+'>'+(resumeSaving?'Saving…':'Save resume')+'</button></div></div>'+
      '<div class="rs-resume-editor-heading"><div><div class="eyebrow">US RESUME · US LETTER</div><h2>'+escHtml(currentResume.title||'Untitled Resume')+'</h2><p class="muted">Edit on the left; the resume preview updates as you type.</p></div><div class="rs-resume-heading-actions"><button type="button" class="secondary" data-resume-action="duplicate">Duplicate</button><button type="button" class="danger" data-resume-action="delete">Delete</button></div></div>';
      let fields='<div class="rs-editor-fields">'+rfield('title','Resume title',currentResume.title||'Untitled Resume');
      const contactLinks=Array.isArray(c.contact?.links)?c.contact.links:[];
      fields+='<section class="rs-edit-section" data-resume-section="contact"><div class="rs-edit-section-head"><h3>Contact</h3></div>'+rfield('content.contact.fullName','Full name',c.contact?.fullName||'')+rfield('content.contact.headline','Professional headline',c.contact?.headline||'')+'<div class="rs-form-grid rs-contact-grid">'+rfield('content.contact.email','Email',c.contact?.email||'')+rfield('content.contact.phone','Phone',c.contact?.phone||'')+rfield('content.contact.location','Location',c.contact?.location||'')+'</div><div class="rs-contact-links">'+contactLinks.map((link,i)=>'<div class="rs-contact-link-row">'+rfield('content.contact.links.'+i+'.label','Link label',link.label||(i===0?'LinkedIn':i===1?'Portfolio':'Professional link'))+rfield('content.contact.links.'+i+'.url',(link.label||(i===0?'LinkedIn':i===1?'Portfolio':'Professional link'))+' URL',link.url||'')+'</div>').join('')+'<button type="button" class="rs-small-button" data-resume-action="add-contact-link">+ Add link</button></div></section>';
      fields+='<section class="rs-edit-section" data-resume-section="summary"><div class="rs-edit-section-head"><h3>Professional Summary</h3>'+rcheck('content.hiddenSections.summary','Hide section',(c.hiddenSections||[]).includes('summary'))+'</div>'+rfield('content.summary','Summary',c.summary||'','textarea')+'</section>';
      for (const section of (c.sectionOrder||resumeSections)) {
        if (section==='summary') continue;
        const items=Array.isArray(c[section])?c[section]:[];
        fields+='<section class="rs-edit-section" data-resume-section="'+section+'"><div class="rs-edit-section-head"><div>'+rfield('content.sectionTitles.'+section,'Section heading',c.sectionTitles?.[section]||resumeSectionNames[section])+'</div>'+rcheck('content.hiddenSections.'+section,'Hide section',(c.hiddenSections||[]).includes(section))+'<div class="rs-order-actions"><button type="button" class="rs-icon-action" data-resume-action="move-section" data-section="'+section+'" data-dir="up" aria-label="Move section up">↑</button><button type="button" class="rs-icon-action" data-resume-action="move-section" data-section="'+section+'" data-dir="down" aria-label="Move section down">↓</button></div></div>';
        if(section==='experience') fields+=items.map((x,i)=>'<article class="rs-resume-entry"><div class="rs-resume-entry-top"><strong>Role '+(i+1)+'</strong><button type=\"button\" class=\"rs-icon-action\" data-resume-action=\"move-entry\" data-section=\"experience\" data-index=\"'+i+'\" data-dir=\"up\" aria-label=\"Move role up\">↑</button><button type=\"button\" class=\"rs-icon-action\" data-resume-action=\"move-entry\" data-section=\"experience\" data-index=\"'+i+'\" data-dir=\"down\" aria-label=\"Move role down\">↓</button>'+rcheck('content.experience.'+i+'.hidden','Hide role',!!x.hidden)+'<button class="rs-remove" type="button" data-resume-action="remove-entry" data-section="experience" data-index="'+i+'">Remove</button></div><div class="rs-form-grid">'+rfield('content.experience.'+i+'.title','Job title',x.title||'')+rfield('content.experience.'+i+'.company','Company',x.company||'')+rfield('content.experience.'+i+'.location','Location',x.location||'')+rfield('content.experience.'+i+'.startDate','Start date',x.startDate||'')+rfield('content.experience.'+i+'.endDate','End date',x.endDate||'')+'</div>'+(x.bullets||[]).map((b,j)=>'<div class="rs-resume-bullet-edit">'+rfield('content.experience.'+i+'.bullets.'+j+'.text','Achievement '+(j+1),b.text||'','textarea')+rcheck('content.experience.'+i+'.bullets.'+j+'.hidden','Hide bullet',!!b.hidden)+'<button type="button" class="rs-remove" data-resume-action="remove-bullet" data-section="experience" data-index="'+i+'" data-bullet="'+j+'">Remove bullet</button></div>').join('')+'<button type="button" class="rs-small-button" data-resume-action="add-bullet" data-section="experience" data-index="'+i+'">+ Add bullet</button></article>').join('')+'<button type="button" class="rs-small-button" data-resume-action="add-entry" data-section="experience">+ Add role</button>';
        if(section==='projects') fields+=items.map((x,i)=>'<article class="rs-resume-entry"><div class="rs-resume-entry-top"><strong>Project '+(i+1)+'</strong><button type=\"button\" class=\"rs-icon-action\" data-resume-action=\"move-entry\" data-section=\"projects\" data-index=\"'+i+'\" data-dir=\"up\" aria-label=\"Move project up\">↑</button><button type=\"button\" class=\"rs-icon-action\" data-resume-action=\"move-entry\" data-section=\"projects\" data-index=\"'+i+'\" data-dir=\"down\" aria-label=\"Move project down\">↓</button>'+rcheck('content.projects.'+i+'.hidden','Hide project',!!x.hidden)+'<button class="rs-remove" type="button" data-resume-action="remove-entry" data-section="projects" data-index="'+i+'">Remove</button></div><div class="rs-form-grid">'+rfield('content.projects.'+i+'.name','Project name',x.name||'')+rfield('content.projects.'+i+'.url','Project URL',x.url||'')+rfield('content.projects.'+i+'.description','Description',x.description||'','textarea')+'</div>'+(x.bullets||[]).map((b,j)=>'<div class="rs-resume-bullet-edit">'+rfield('content.projects.'+i+'.bullets.'+j+'.text','Achievement '+(j+1),b.text||'','textarea')+rcheck('content.projects.'+i+'.bullets.'+j+'.hidden','Hide bullet',!!b.hidden)+'<button type="button" class="rs-remove" data-resume-action="remove-bullet" data-section="projects" data-index="'+i+'" data-bullet="'+j+'">Remove bullet</button></div>').join('')+'<button type="button" class="rs-small-button" data-resume-action="add-bullet" data-section="projects" data-index="'+i+'">+ Add bullet</button></article>').join('')+'<button type="button" class="rs-small-button" data-resume-action="add-entry" data-section="projects">+ Add project</button>';
        if(section==='skills') fields+=items.map((x,i)=>'<article class="rs-resume-entry"><div class="rs-resume-entry-top"><strong>Skill group '+(i+1)+'</strong><button type=\"button\" class=\"rs-icon-action\" data-resume-action=\"move-entry\" data-section=\"skills\" data-index=\"'+i+'\" data-dir=\"up\" aria-label=\"Move skill group up\">↑</button><button type=\"button\" class=\"rs-icon-action\" data-resume-action=\"move-entry\" data-section=\"skills\" data-index=\"'+i+'\" data-dir=\"down\" aria-label=\"Move skill group down\">↓</button>'+rcheck('content.skills.'+i+'.hidden','Hide group',!!x.hidden)+'<button class="rs-remove" type="button" data-resume-action="remove-entry" data-section="skills" data-index="'+i+'">Remove</button></div><div class="rs-form-grid">'+rfield('content.skills.'+i+'.category','Category',x.category||'')+rfield('content.skills.'+i+'.items','Skills (comma-separated)',(x.items||[]).join(', '),'textarea')+'</div></article>').join('')+'<button type="button" class="rs-small-button" data-resume-action="add-entry" data-section="skills">+ Add skill group</button>';
        if(section==='education') fields+=items.map((x,i)=>'<article class="rs-resume-entry"><div class="rs-resume-entry-top"><strong>Education '+(i+1)+'</strong><button type=\"button\" class=\"rs-icon-action\" data-resume-action=\"move-entry\" data-section=\"education\" data-index=\"'+i+'\" data-dir=\"up\" aria-label=\"Move education up\">↑</button><button type=\"button\" class=\"rs-icon-action\" data-resume-action=\"move-entry\" data-section=\"education\" data-index=\"'+i+'\" data-dir=\"down\" aria-label=\"Move education down\">↓</button>'+rcheck('content.education.'+i+'.hidden','Hide entry',!!x.hidden)+'<button class="rs-remove" type="button" data-resume-action="remove-entry" data-section="education" data-index="'+i+'">Remove</button></div><div class="rs-form-grid">'+rfield('content.education.'+i+'.institution','Institution',x.institution||'')+rfield('content.education.'+i+'.degree','Degree',x.degree||'')+rfield('content.education.'+i+'.field','Field of study',x.field||'')+rfield('content.education.'+i+'.startDate','Start date',x.startDate||'')+rfield('content.education.'+i+'.endDate','End date',x.endDate||'')+rfield('content.education.'+i+'.notes','Notes',x.notes||'','textarea')+'</div></article>').join('')+'<button type="button" class="rs-small-button" data-resume-action="add-entry" data-section="education">+ Add education</button>';
        if(section==='certifications') fields+=items.map((x,i)=>'<article class="rs-resume-entry"><div class="rs-resume-entry-top"><strong>Certification '+(i+1)+'</strong><button type=\"button\" class=\"rs-icon-action\" data-resume-action=\"move-entry\" data-section=\"certifications\" data-index=\"'+i+'\" data-dir=\"up\" aria-label=\"Move certification up\">↑</button><button type=\"button\" class=\"rs-icon-action\" data-resume-action=\"move-entry\" data-section=\"certifications\" data-index=\"'+i+'\" data-dir=\"down\" aria-label=\"Move certification down\">↓</button>'+rcheck('content.certifications.'+i+'.hidden','Hide entry',!!x.hidden)+'<button class="rs-remove" type="button" data-resume-action="remove-entry" data-section="certifications" data-index="'+i+'">Remove</button></div><div class="rs-form-grid">'+rfield('content.certifications.'+i+'.name','Certification',x.name||'')+rfield('content.certifications.'+i+'.issuer','Issuer',x.issuer||'')+rfield('content.certifications.'+i+'.date','Date',x.date||'')+'</div></article>').join('')+'<button type="button" class="rs-small-button" data-resume-action="add-entry" data-section="certifications">+ Add certification</button>';
        fields+='</section>';
      }
      fields+='</div>';
      const fieldsShell=document.createElement('div');
      fieldsShell.innerHTML=fields;
      const fieldsRoot=fieldsShell.firstElementChild;
      const stepDefinitions=[
        {title:'Basics',description:'Name and contact details'},
        {title:'Summary',description:'Professional introduction'},
        {title:'Experience',description:'Roles and achievements'},
        {title:'Projects',description:'Selected work'},
        {title:'Skills',description:'Relevant capabilities'},
        {title:'Education',description:'Education and certifications'}
      ];
      const stepPanels=stepDefinitions.map((step,index)=>'<section class="rs-editor-step-panel" data-editor-step-panel="'+index+'" '+(resumeEditorStep===index?'':'hidden')+'><div class="rs-editor-step-heading"><span>STEP '+(index+1)+' OF '+stepDefinitions.length+'</span><h3>'+step.title+'</h3><p>'+step.description+'</p></div></section>');
      const panelsShell=document.createElement('div');
      panelsShell.innerHTML=stepPanels.join('');
      const panels=Array.from(panelsShell.children);
      Array.from(fieldsRoot.children).forEach((node,index)=>{
        let step=0;
        if(node.matches('[data-resume-section="summary"]')) step=1;
        else if(node.matches('[data-resume-section="experience"]')) step=2;
        else if(node.matches('[data-resume-section="projects"]')) step=3;
        else if(node.matches('[data-resume-section="skills"]')) step=4;
        else if(node.matches('[data-resume-section="education"],[data-resume-section="certifications"]')) step=5;
        panels[step].appendChild(node);
      });
      const stepper='<nav class="rs-editor-stepper" aria-label="Resume creation steps">'+stepDefinitions.map((step,index)=>'<button type="button" class="rs-editor-step '+(resumeEditorStep===index?'is-active':index<resumeEditorStep?'is-complete':'')+'" data-resume-action="editor-step" data-step="'+index+'" aria-current="'+(resumeEditorStep===index?'step':'false')+'"><span class="rs-editor-step-number">'+(index<resumeEditorStep?'✓':index+1)+'</span><span class="rs-editor-step-copy"><strong>'+step.title+'</strong><small>'+step.description+'</small></span></button>').join('')+'</nav>';
      const stepNavigation='<div class="rs-editor-step-navigation"><button type="button" class="secondary" data-resume-action="editor-prev" '+(resumeEditorStep===0?'disabled':'')+'>← Previous</button><span>Step '+(resumeEditorStep+1)+' of '+stepDefinitions.length+'</span><button type="button" class="primary" data-resume-action="editor-next">'+(resumeEditorStep===stepDefinitions.length-1?'Complete ✓':'Next step →')+'</button></div>';
      const sequentialFields='<div class="rs-editor-fields">'+panels.map(panel=>panel.outerHTML).join('')+stepNavigation+'</div>';
      root.innerHTML=head+editorHeader+'<div class="rs-resume-workspace rs-resume-workspace-sequential"><aside class="rs-resume-stepper-pane">'+stepper+'</aside><div class="rs-resume-form-pane">'+sequentialFields+'</div></div>'+(resumeAnalyzing?'<div class="rs-analysis-loading"><span class="rs-spinner" aria-hidden="true"></span><span>Reviewing resume structure and evidence…</span></div>':'')+(resumeAnalysis&&resumeAnalysisOpen?resumeAnalysisHtml():'');
      root.querySelectorAll('textarea[data-resume-path]').forEach(field=>{field.style.height='auto';field.style.height=Math.max(field.scrollHeight,42)+'px';});
      updateEditorToolbarStickiness();
      return;
    }
    root.innerHTML=head+'<div class="rs-list-head"><div><h3>Your resumes</h3><p>Saved documents are independent copies of your Master Profile.</p></div><span class="rs-profile-count">'+resumeRows.length+' resume'+(resumeRows.length===1?'':'s')+'</span></div>'+
      (resumeMessage?'<div class="rs-notice"><p>'+escHtml(resumeMessage)+'</p></div>':'')+
      (resumeRows.length?'<div class="rs-resume-list">'+resumeRows.map(row=>'<article class="rs-resume-card"><div class="rs-resume-card-icon" aria-hidden="true">CV</div><div class="rs-resume-card-main"><h3>'+escHtml(row.title||'Untitled Resume')+'</h3><p>US Resume · Updated '+escHtml(row.updated_at?new Date(row.updated_at).toLocaleString():'just now')+'</p></div><div class="rs-resume-card-actions"><button class="secondary" type="button" data-resume-action="open" data-id="'+escHtml(row.id)+'">Open editor</button><button class="secondary" type="button" data-resume-action="duplicate" data-id="'+escHtml(row.id)+'">Duplicate</button><button class="danger" type="button" data-resume-action="delete" data-id="'+escHtml(row.id)+'">Delete</button></div></article>').join('')+'</div>':'<div class="rs-empty-resumes"><div class="rs-empty-icon">CV</div><h3>No resumes yet</h3><p>Create your first resume using the information in your Master Profile. You can edit the copy without changing the source profile.</p><button type="button" class="primary" data-resume-action="new">Create your first resume</button></div>');
  }
  function resumePreviewHtml(c) {
    const hidden=new Set(c.hiddenSections||[]);
    const esc=escHtml;
    const contact=c.contact||{};
    const links=(contact.links||[]).filter(x=>!x.hidden&&x.url);
    const contactLine=[contact.email,contact.phone,contact.location].filter(Boolean).map(esc).join(' <span class="rs-preview-sep">|</span> ');
    const linksLine=links.map(x=>esc(x.url)).join(' <span class="rs-preview-sep">|</span> ');
    const chosenCustom=window.CustomResumeTemplates?.find(t=>'custom:'+t.id===c.template);
    const customOrder=chosenCustom?.config?.documentLayout;
    if(chosenCustom?.config?.useCustomDocumentLayout&&Array.isArray(chosenCustom.config.layout)&&chosenCustom.config.layout.length&&window.CVTEAdvanced?.exportHtml){return '<div class="rs-custom-document-content" style="position:relative;min-height:100%;pointer-events:none">'+window.CVTEAdvanced.exportHtml(chosenCustom.config.layout,c)+'</div>'}
    const orderedSections=Array.isArray(customOrder)&&customOrder.length?customOrder:[...new Set([...(c.sectionOrder||resumeSections),'languages','references'])];
    let html='<header class="rs-paper-header"><h1>'+esc(contact.fullName||'Your Name')+'</h1>'+(contact.headline?'<p class="rs-paper-headline">'+esc(contact.headline)+'</p>':'')+'<div class="rs-paper-contact"><div class="rs-paper-contact-details">'+contactLine+'</div><div class="rs-paper-contact-links">'+linksLine+'</div></div></header>';
    for(const section of orderedSections) {
      if(hidden.has(section)) continue;
      const title=esc(c.sectionTitles?.[section]||resumeSectionNames[section]||({languages:'Languages',references:'References'}[section])||section);
      let body='';
      if(section==='summary'&&String(c.summary||'').trim()) body='<p class="rs-paper-summary">'+esc(c.summary).replace(/\n/g,'<br>')+'</p>';
      if(section==='experience') body=(c.experience||[]).filter(x=>!x.hidden).map(x=>'<div class="rs-paper-entry"><div class="rs-paper-entry-head"><strong>'+esc(x.title||'')+'</strong><span>'+esc([x.startDate,x.endDate|| (x.current?'Present':'')].filter(Boolean).join(' – '))+'</span></div><div class="rs-paper-subhead"><strong>'+esc(x.company||'')+'</strong><span>'+esc(x.location||'')+'</span></div><ul>'+((x.bullets||[]).filter(b=>!b.hidden&&String(b.text||'').trim()).map(b=>'<li>'+esc(b.text)+'</li>').join(''))+'</ul></div>').join('');
      if(section==='projects') body=(c.projects||[]).filter(x=>!x.hidden).map(x=>'<div class="rs-paper-entry"><div class="rs-paper-entry-head"><strong>'+esc(x.name||'')+'</strong><span>'+esc(x.url||'')+'</span></div>'+(x.description?'<p>'+esc(x.description)+'</p>':'')+'<ul>'+((x.bullets||[]).filter(b=>!b.hidden&&String(b.text||'').trim()).map(b=>'<li>'+esc(b.text)+'</li>').join(''))+'</ul></div>').join('');
      if(section==='skills') body=(c.skills||[]).filter(x=>!x.hidden&&((x.items||[]).length||x.category)).map(x=>'<p class="rs-paper-skill"><strong>'+esc(x.category||'Skills')+':</strong> '+esc((x.items||[]).join(', '))+'</p>').join('');
      if(section==='education') body=(c.education||[]).filter(x=>!x.hidden).map(x=>'<div class="rs-paper-entry"><div class="rs-paper-entry-head"><strong>'+esc([x.degree,x.field].filter(Boolean).join(' in '))+'</strong><span>'+esc([x.startDate,x.endDate].filter(Boolean).join(' – '))+'</span></div><div class="rs-paper-subhead"><strong>'+esc(x.institution||'')+'</strong><span>'+esc(x.notes||'')+'</span></div></div>').join('');
      if(section==='certifications') body=(c.certifications||[]).filter(x=>!x.hidden).map(x=>'<p class="rs-paper-skill"><strong>'+esc(x.name||'')+'</strong>'+((x.issuer||x.date)?' — '+esc([x.issuer,x.date].filter(Boolean).join(', ')):'')+'</p>').join('');
      if(section==='languages') body=(c.languages||[]).filter(x=>x.name).map(x=>'<p class="rs-paper-skill"><strong>'+esc(x.name)+'</strong>'+(x.proficiency?' — '+esc(x.proficiency):'')+'</p>').join('');
      if(section==='references') body=(c.references||[]).filter(x=>x.name).map(x=>'<div class="rs-paper-entry"><strong>'+esc(x.name)+'</strong><p>'+esc([x.title,x.company].filter(Boolean).join(' · '))+'</p><p>'+esc([x.email,x.phone].filter(Boolean).join(' · '))+'</p></div>').join('');
      if(body.trim()) html+='<section class="rs-paper-section"><h2>'+title+'</h2>'+body+'</section>';
    }
    // Languages and references are rendered in the selected template's document order above.
    return html;
  }
  async function loadResumeList() {
    resumeLoading=true; renderResumeView();
    try { resumeRows=await api('/admin-resumes'); resumeMessage=''; }
    catch(error) { resumeMessage=error.message||'Could not load resumes.'; resumeRows=[]; }
    finally { resumeLoading=false; renderResumeView(); }
  }
  async function openResume(id) {
    resumeLoading=true; renderResumeView();
    try { currentResume=await api('/admin-resumes?id='+encodeURIComponent(id)); resumeSavedJson=JSON.stringify(currentResume.content); resumeSavedTitle=currentResume.title; resumeEditorResumeId=currentResume.id; resumeEditorStep=0; resumePreviewMode=false; restoreResumeReview(currentResume.id); resumeMessage=''; renderResumeView(); }
    catch(error) { currentResume=null; resumeMessage=error.message||'Could not open this resume.'; await loadResumeList(); }
    finally { resumeLoading=false; }
  }
  function requestResumeTitle() {
    return new Promise(resolve => {
      const overlay=document.createElement('div');
      overlay.className='rs-confirm-backdrop';
      overlay.innerHTML='<section class="rs-confirm-modal is-neutral rs-name-modal" role="dialog" aria-modal="true" aria-labelledby="rsNameTitle"><div class="rs-confirm-icon" aria-hidden="true">CV</div><h3 id="rsNameTitle">Name this resume</h3><p>Choose a clear name so you can find this resume later.</p><form class="rs-name-form"><label for="rsResumeName">Resume name</label><input id="rsResumeName" name="resumeName" type="text" maxlength="120" required value="Product Designer Resume" autocomplete="off"/><div class="rs-confirm-actions"><button type="button" class="secondary" data-name-cancel>Cancel</button><button type="submit" class="primary">Create resume</button></div></form></section>';
      const input=overlay.querySelector('#rsResumeName');
      const finish=value=>{overlay.remove();document.removeEventListener('keydown',onKey);resolve(value);};
      const onKey=event=>{if(event.key==='Escape'){event.preventDefault();finish(null);}};
      overlay.addEventListener('click',event=>{if(event.target===overlay||event.target.closest('[data-name-cancel]'))finish(null);});
      overlay.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const value=input.value.trim();if(value)finish(value);else input.focus();});
      document.addEventListener('keydown',onKey);document.body.appendChild(overlay);input.focus();input.select();
    });
  }
  async function createResume() {
    const title=await requestResumeTitle();
    if(title===null) return;
    resumeLoading=true; renderResumeView();
    try { currentResume=await api('/admin-resumes',{method:'POST',body:JSON.stringify({title:title.trim()||'Untitled Resume'})}); resumeSavedJson=JSON.stringify(currentResume.content); resumeSavedTitle=currentResume.title; resumeEditorResumeId=currentResume.id; resumeEditorStep=0; resumePreviewMode=false; resumeMessage=''; renderResumeView(); }
    catch(error) { resumeMessage=error.message||'Could not create resume.'; await loadResumeList(); }
    finally { resumeLoading=false; }
  }
  async function saveResume() {
    if(!currentResume||resumeSaving||!resumeIsDirty()) return;
    resumeSaving=true; resumeMessage='Saving…'; renderResumeView();
    try { currentResume=await api('/admin-resumes?id='+encodeURIComponent(currentResume.id),{method:'PUT',body:JSON.stringify({id:currentResume.id,title:currentResume.title,content:currentResume.content})}); resumeSavedJson=JSON.stringify(currentResume.content); resumeSavedTitle=currentResume.title; resumeMessage='Saved successfully'; }
    catch(error) { resumeMessage='Save failed: '+(error.message||'Please retry.'); }
    finally { resumeSaving=false; renderResumeView(); }
  }
  async function resumeAction(button, event) {
    const action=button.dataset.resumeAction, id=button.dataset.id||currentResume?.id;
    if(action==='editor-step' || action==='editor-prev' || action==='editor-next') {
      const lastStep=5;
      if(action==='editor-step') resumeEditorStep=Math.max(0,Math.min(lastStep,Number(button.dataset.step)||0));
      else if(action==='editor-prev') resumeEditorStep=Math.max(0,resumeEditorStep-1);
      else if(resumeEditorStep===lastStep) { resumePreviewMode=true; renderResumeView(); root.scrollTo?.({top:0,behavior:'smooth'}); window.scrollTo({top:0,behavior:'smooth'}); return; }
      else resumeEditorStep=Math.min(lastStep,resumeEditorStep+1);
      renderResumeView();
      root.querySelector('[data-editor-step-panel="'+resumeEditorStep+'"] input, [data-editor-step-panel="'+resumeEditorStep+'"] textarea')?.focus({preventScroll:true});
      return;
    }
    if(action==='analyze') {
      if(!currentResume || resumeAnalyzing) return;
      const resumeText=resumeAnalysisText(currentResume);
      if(resumeText.replace(/\s/g,'').length<80) { resumeMessage='Add more resume details before running an analysis.'; renderResumeView(); return; }
      resumeAnalyzing=true; resumeMessage=''; resumeAnalysis=null; resumeAnalysisOpen=false; resumeAnalysisTab='analysis'; resumeSuggestions=[]; resumeJobSuggestions=[]; clearResumeReview(currentResume?.id); renderResumeView();
      try {
        const analysisEndpoint='/api/admin-resume-studio';
        const result=await api(analysisEndpoint,{method:'POST',body:JSON.stringify({action:'analyze-resume',master_resume_text:resumeText})});
        resumeAnalysis=normalizeResumeAnalysis(result?.analysis);
        resumeAnalysisOpen=true;
        persistResumeReview();
        resumeMessage='Analysis complete. No resume content was changed.';
        autoClearResumeMessage(resumeMessage,12000);
      } catch(error) {
        resumeAnalysis=null; resumeAnalysisOpen=false;
        resumeMessage='Analysis failed: '+(error.message||'Please try again.');
        autoClearResumeMessage(resumeMessage,12000);
      }
      finally { resumeAnalyzing=false; renderResumeView(); }
      return;
    }
    if(action==='view-analysis') { if(resumeAnalysis) { resumeAnalysisOpen=true; resumeAnalysisTab='analysis'; persistResumeReview(); renderResumeView(); root.querySelector('.rs-analysis-modal')?.focus(); } return; }
    if(action==='analysis-tab') { resumeAnalysisTab=button.dataset.tabValue==='suggestions'?'suggestions':'analysis'; persistResumeReview(); renderResumeView(); root.querySelector('.rs-analysis-modal')?.focus(); return; }
    if(action==='suggestion-mode') { resumeSuggestionMode=button.dataset.mode==='job'?'job':'general'; persistResumeReview(); renderResumeView(); root.querySelector('.rs-analysis-modal')?.focus(); return; }
    if(action==='generate-suggestions') {
      if(!currentResume || resumeSuggestionsLoading) return;
      const resumeText=resumeAnalysisText(currentResume);
      if(resumeText.replace(/\s/g,'').length<80) { resumeMessage='Add more resume details before generating suggestions.'; renderResumeView(); return; }
      resumeSuggestionsLoading=true; resumeSuggestionError=''; resumeSuggestionMode='general'; resumeAnalysisTab='suggestions'; resumeSuggestions=[]; renderResumeView();
      try {
        const analysisEndpoint='/api/admin-resume-studio';
        const result=await api(analysisEndpoint,{method:'POST',body:JSON.stringify({action:'suggest-resume-fixes',master_resume_text:resumeText,analysis:resumeAnalysis})});
        if(!Array.isArray(result?.suggestions)||!result.suggestions.length) throw new Error('No usable suggestions were returned. Please try again.');
        resumeSuggestions=result.suggestions.slice(0,8).map(item=>({title:String(item?.title||'Resume improvement').slice(0,160),reason:String(item?.reason||'').slice(0,800),text:String(item?.text||'').slice(0,4000)})).filter(item=>item.text.trim());
        if(!resumeSuggestions.length) throw new Error('No editable examples were returned. Please try again.');
        persistResumeReview();
      } catch(error) {
        resumeSuggestionError=error.message||'The AI service did not return suggestions. Please try again.';
        resumeMessage='Suggestion generation failed: '+resumeSuggestionError;
        persistResumeReview();
      }
      finally { resumeSuggestionsLoading=false; renderResumeView(); root.querySelector('.rs-analysis-modal')?.focus(); }
      return;
    }
    if(action==='generate-job-suggestions') {
      if(!currentResume || resumeJobSuggestionsLoading) return;
      const resumeText=resumeAnalysisText(currentResume);
      const jobDescription=resumeJobDescription.trim();
      if(resumeText.replace(/\\s/g,'').length<80) { resumeMessage='Add more resume details before generating job-specific suggestions.'; renderResumeView(); return; }
      if(jobDescription.length<80) { resumeMessage='Paste the full job description (at least 80 characters) before generating job-specific suggestions.'; autoClearResumeMessage(resumeMessage,12000); renderResumeView(); return; }
      if(jobDescription.length>20000) { resumeMessage='The job description must be 20,000 characters or fewer.'; autoClearResumeMessage(resumeMessage,12000); renderResumeView(); return; }
      resumeJobSuggestionsLoading=true; resumeSuggestionMode='job'; resumeAnalysisTab='suggestions'; resumeJobSuggestions=[]; resumeMessage=''; renderResumeView();
      try {
        const analysisEndpoint='/api/admin-resume-studio';
        const result=await api(analysisEndpoint,{method:'POST',body:JSON.stringify({action:'suggest-job-specific-fixes',master_resume_text:resumeText,analysis:resumeAnalysis,job_description:jobDescription})});
        if(!Array.isArray(result?.suggestions)||!result.suggestions.length) throw new Error('No job-specific suggestions were returned. Please try again.');
        resumeJobSuggestions=result.suggestions.slice(0,8).map(item=>({title:String(item?.title||'Job-specific improvement').slice(0,160),reason:String(item?.reason||'').slice(0,800),text:String(item?.text||'').slice(0,4000)})).filter(item=>item.text.trim());
        if(!resumeJobSuggestions.length) throw new Error('No editable job-specific examples were returned. Please try again.');
        persistResumeReview();
      } catch(error) {
        resumeMessage='Job-specific suggestions failed: '+(error.message||'Please try again.');
        autoClearResumeMessage(resumeMessage,12000);
      } finally { resumeJobSuggestionsLoading=false; renderResumeView(); root.querySelector('.rs-analysis-modal')?.focus(); }
      return;
    }
    if(action==='copy-suggestion') {
      const list=button.dataset.suggestionKind==='job'?resumeJobSuggestions:resumeSuggestions;
      const item=list[Number(button.dataset.index)];
      if(!item?.text) return;
      try { await navigator.clipboard.writeText(item.text); if(typeof cmsToast==='function') cmsToast('Suggestion copied. Verify every claim before using it.'); else resumeMessage='Suggestion copied. Verify every claim before using it.'; }
      catch(error) { const field=root.querySelector('[data-suggestion-index="'+Number(button.dataset.index)+'"][data-suggestion-kind="'+(button.dataset.suggestionKind||'general')+'"]'); if(field) { field.focus(); field.select(); resumeMessage='Clipboard access was blocked. The suggestion is selected so you can copy it manually.'; } }
      return;
    }
    if(action==='close-analysis') { if(button.dataset.overlayBackdrop==='true' && event.target!==button) return; resumeAnalysisOpen=false; persistResumeReview(); renderResumeView(); return; }
    if(action==='clear-analysis') { resumeAnalysis=null; resumeAnalysisOpen=false; resumeSuggestions=[]; resumeJobSuggestions=[]; clearResumeReview(currentResume?.id); renderResumeView(); return; }
    if(action==='new') return createResume();
    if(action==='back') { if(currentResume&&resumeIsDirty()&&!await confirmDialog('Discard unsaved changes to this resume?')) return; currentResume=null; resumePreviewMode=false; resumeEditorStep=0; return loadResumeList(); }
    if(action==='open') return openResume(id);
    if(action==='save') return saveResume();
    if(action==='print') { const paper=document.getElementById('rsResumePreview'); if(!paper)return; const w=window.open('','_blank','width=1000,height=800'); if(!w){alert('Allow pop-ups to print or save the resume as PDF.');return;} const a4=currentResume.content?.pageSize==='a4'; const template=currentResume.content?.template||'classic'; const accent=currentResume.content?.accent||'#23395B'; const customTemplate=window.CustomResumeTemplates?.find(t=>'custom:'+t.id===template); const customConfig=customTemplate?.config||{}; let customLayoutHtml=(Array.isArray(customConfig.layout)?customConfig.layout:[]).map(n=>{const st='position:absolute;left:'+Math.max(0,Math.min(100,Number(n.x)||0))+'%;top:'+Math.max(0,Math.min(100,Number(n.y)||0))+'%;width:'+Math.max(5,Math.min(100,Number(n.w)||30))+'%;min-height:'+Math.max(1,Math.min(100,Number(n.h)||10))+'%;color:'+( /^#[0-9a-fA-F]{6}$/.test(n.color||'')?n.color:'#F8831D')+';font-size:'+Math.max(7,Math.min(32,Number(n.fontSize)||11))+'px;overflow-wrap:anywhere;';const color=/^#[0-9a-fA-F]{6}$/.test(n.color||'')?n.color:'#F8831D';let body=n.type==='shape'?'<div style=\"width:100%;height:100%;min-height:36px;background:'+color+';border-radius:6px\"></div>':n.type==='line'?'<div style=\"height:'+Math.max(1,Math.min(12,Number(n.weight)||1))+'px;background:'+color+';width:100%\"></div>':n.type==='bullets'?'<ul style=\"margin:0;padding-left:18px;list-style-type:'+(n.bullet==='number'?'decimal':n.bullet==='square'?'square':n.bullet==='circle'?'circle':'disc')+'\">'+String(n.text||'').split('\\n').map(t=>'<li>'+escHtml(t)+'</li>').join('')+'</ul>':'<div>'+escHtml(n.text||'')+'</div>';return '<div style=\"'+st+'\">'+body+'</div>'}).join(''); if(window.CVTEAdvanced?.exportHtml) customLayoutHtml=customConfig.useCustomDocumentLayout?'':window.CVTEAdvanced.exportHtml(customConfig.layout,currentResume.content); w.document.write('<!doctype html><html><head><title>'+escHtml(currentResume.title||'Resume')+'</title><link rel="stylesheet" href="/admin/resume-templates.css"><style>@page{size:'+(a4?'A4':'letter')+';margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#171717}.paper{position:relative;isolation:isolate;--resume-user-accent:'+accent+';width:'+(a4?'210mm':'8.5in')+';min-height:'+(a4?'297mm':'11in')+';padding:.55in;font-size:10pt;line-height:1.32}.paper,.paper *{box-sizing:border-box}.paper:has(.rs-custom-document-content){padding:0}.paper h1{font-size:24pt;line-height:1.12;margin:0 0 5pt;font-weight:600}.paper-headline{font-size:13pt;margin:0 0 9pt}.paper-contact{font-size:9pt;line-height:1.6;margin-top:5pt}.paper-contact-details,.paper-contact-links{display:block;text-align:center}.paper-section{margin-top:15pt;break-inside:auto}.paper-section h2{font-size:11pt;line-height:1.2;text-transform:uppercase;border-bottom:1px solid #d5d7da;padding-bottom:4pt;margin:0 0 7pt;color:var(--resume-user-accent)}.paper-entry{margin-bottom:9pt;break-inside:avoid}.paper-entry-head,.paper-subhead{display:flex;justify-content:space-between;align-items:baseline;gap:8pt;font-size:10pt}.paper-entry-head>span,.paper-subhead>span{flex-shrink:0;text-align:right}.paper ul{margin:4pt 0 0;padding-left:16pt;line-height:1.3}.paper li{margin-bottom:2pt}.paper p{line-height:1.35;margin:3pt 0}.paper-skill{display:inline-block;margin:2pt 4pt 2pt 0;padding:3pt 6pt}.paper.rs-custom-template{font-family:'+escHtml(customConfig.font||'Arial')+';font-size:'+(Number(customConfig.bodySize)||10)+'pt;line-height:1.35}.paper.rs-custom-template .paper-header h1{font-size:'+(Number(customConfig.nameSize)||24)+'pt}.paper.rs-custom-template .paper-header{text-align:'+(customConfig.headerAlign==='left'?'left':'center')+'}.paper.rs-custom-template .paper-section{margin-top:'+(Number(customConfig.spacing)||15)+'pt}.paper.rs-custom-template .paper-section h2{color:'+escHtml(customConfig.accent||accent)+';border-bottom:'+(customConfig.headingStyle==='underline'?'1px solid '+escHtml(customConfig.accent||accent):'0')+'}.paper.rs-custom-template .paper-section h2{background:'+(customConfig.headingStyle==='accent-block'?escHtml(customConfig.accent||accent):'transparent')+';color:'+(customConfig.headingStyle==='accent-block'?'#fff':escHtml(customConfig.accent||accent))+';padding:'+(customConfig.headingStyle==='accent-block'?'4pt 6pt':'0 0 4pt')+'}.paper.rs-custom-template .paper-skill{border-radius:'+(customConfig.skillStyle==='pills'?'12pt':'0')+';background:'+(customConfig.skillStyle==='pills'?'#eef0f3':'transparent')+'}.paper.rs-template-t1{padding:0 .62in .55in}.paper.rs-template-t1 .paper-header{background:'+accent+';color:#fff;text-align:center;margin:0 -.62in 18pt;padding:28pt .62in 20pt;border-bottom:2pt solid #d7e0eb;-webkit-print-color-adjust:exact;print-color-adjust:exact}.paper.rs-template-t1 .paper-header h1,.paper.rs-template-t1 .paper-headline,.paper.rs-template-t1 .paper-contact{color:#fff}.paper.rs-template-t1 .paper-header h1{font-size:25pt;font-weight:500}.paper.rs-template-t1 .paper-section h2{border:0;text-transform:none;font-size:14pt}.paper.rs-template-t1 .paper-skill{border-radius:12pt;background:#e9edf2}.paper.rs-template-t2{padding:.55in;font-family:Arial,Helvetica,sans-serif}.paper.rs-template-t2 .paper-header{text-align:center;padding-bottom:14pt;margin-bottom:15pt;border-bottom:1pt solid #d8dadd}.paper.rs-template-t2 .paper-header h1{font-size:24pt;font-weight:500;color:'+accent+'}.paper.rs-template-t2 .paper-section{padding-top:10pt;border-top:1pt solid #d8dadd;position:relative}.paper.rs-template-t2 .paper-section:before{content:&quot;&quot;;display:block;width:10%;height:3pt;background:'+accent+';position:absolute;top:-1pt;left:0}.paper.rs-template-t2 .paper-section h2{border:0;color:'+accent+'}.paper.rs-template-t3{padding:.55in}.paper.rs-template-t3 .paper-header{text-align:center;margin-bottom:14pt}.paper.rs-template-t3 .paper-header h1{font-size:22pt;color:#171717}.paper.rs-template-t3 .paper-section{display:grid;grid-template-columns:23% minmax(0,1fr);gap:12pt;padding:10pt 0;margin:0;border-top:1.5pt solid #34383b}.paper.rs-template-t3 .paper-section h2{font-size:10pt;font-weight:500;border:0;color:#42464a}.paper.rs-template-t3 .paper-section>*:not(h2){grid-column:2}.paper.rs-template-t3 .paper-section h2{grid-column:1;grid-row:1 / span 99}.paper.rs-template-t4{padding:0 .55in .55in}.paper.rs-template-t4 .paper-header{background:#f7f0f2;text-align:center;margin:0 -.55in 14pt;padding:24pt .55in 18pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}.paper.rs-template-t4 .paper-header h1{font-size:23pt;color:#171717}.paper.rs-template-t4 .paper-headline{color:'+accent+'}.paper.rs-template-t4 .paper-contact{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5pt 10pt;text-align:left}.paper.rs-template-t4 .paper-section h2{display:inline-block;padding:4pt 7pt;background:'+accent+';color:#fff;border:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}.paper.rs-template-t4 .paper-skill{border-radius:12pt;background:#f7f0f2}.paper{box-decoration-break:clone;-webkit-box-decoration-break:clone}.paper .paper-header h1{text-align:inherit}.paper-skill,.paper.rs-template-t1 .paper-skill,.paper.rs-template-t4 .paper-skill,.paper.rs-template-t4 .paper-section h2{border-radius:6px!important}@media print{.paper{box-decoration-break:clone;-webkit-box-decoration-break:clone}.paper-section{break-inside:auto;orphans:3;widows:3}.paper-entry{break-inside:avoid;page-break-inside:avoid}.paper-header{break-inside:avoid;break-after:avoid-page}}</style></head><body id=\\\"resumeTab\\\"><div class="paper">'+paper.innerHTML.replaceAll('rs-paper-','paper-').replace(/class="paper-([^"]+)"/g,'class="rs-paper-$1 paper-$1"').replaceAll('rs-preview-sep','paper-sep')+'<div style="position:absolute;inset:0;pointer-events:none">'+customLayoutHtml+'</div></div><script>window.onload=()=>{window.print()}</script></body></html>'); const exportedPaper=w.document.querySelector('.paper');if(exportedPaper)exportedPaper.classList.add('rs-resume-paper','rs-template-'+template);w.document.body.id='resumeTab'; w.document.close(); return; }
    if(action==='duplicate') { if(!await confirmDialog('Create a separate copy of this resume?',{title:'Duplicate resume',confirmLabel:'Duplicate'})) return; resumeLoading=true; renderResumeView(); try { currentResume=await api('/admin-resumes',{method:'POST',body:JSON.stringify({action:'duplicate',id,title:'Copy of '+(resumeRows.find(x=>String(x.id)===String(id))?.title||currentResume?.title||'Resume')})}); resumeSavedJson=JSON.stringify(currentResume.content); resumeSavedTitle=currentResume.title; resumeEditorResumeId=currentResume.id; resumeEditorStep=0; resumePreviewMode=false; resumeMessage=''; renderResumeView(); } catch(error) { resumeMessage=error.message||'Could not duplicate resume.'; currentResume=null; await loadResumeList(); } finally {resumeLoading=false;} return; }
    if(action==='delete') { if(!await confirmDialog('Delete this resume and its saved versions? This cannot be undone.',{title:'Delete resume',confirmLabel:'Delete',tone:'danger'})) return; try { await api('/admin-resumes?id='+encodeURIComponent(id),{method:'DELETE',body:JSON.stringify({id})}); clearResumeReview(id); currentResume=null; resumeMessage='Resume deleted.'; await loadResumeList(); } catch(error) { resumeMessage=error.message||'Could not delete resume.'; renderResumeView(); } return; }
    if(action==='add-contact-link') { currentResume.content.contact ||= {fullName:'',email:'',phone:'',location:'',links:[]}; currentResume.content.contact.links ||= []; currentResume.content.contact.links.push({label:'',url:'',hidden:false}); renderResumeView(); return; }
    if(action==='add-entry') { const sec=button.dataset.section; const defaults={experience:{id:uid(),company:'',title:'',location:'',startDate:'',endDate:'',current:false,hidden:false,bullets:[]},projects:{id:uid(),name:'',url:'',description:'',hidden:false,bullets:[]},skills:{id:uid(),category:'',items:[],hidden:false},education:{id:uid(),institution:'',degree:'',field:'',startDate:'',endDate:'',notes:'',hidden:false},certifications:{id:uid(),name:'',issuer:'',date:'',hidden:false}}; currentResume.content[sec].push(defaults[sec]); renderResumeView(); return; }
    if(action==='remove-entry') { const sec=button.dataset.section, index=Number(button.dataset.index); if(!await confirmDialog('Remove this entry from the resume?',{title:'Remove resume entry',confirmLabel:'Remove',tone:'danger'}))return; currentResume.content[sec].splice(index,1); renderResumeView(); return; }
    if(action==='add-bullet') { const sec=button.dataset.section,index=Number(button.dataset.index); currentResume.content[sec][index].bullets.push({id:uid(),text:'',hidden:false}); renderResumeView(); return; }
    if(action==='remove-bullet') { const sec=button.dataset.section,index=Number(button.dataset.index),bi=Number(button.dataset.bullet); currentResume.content[sec][index].bullets.splice(bi,1); renderResumeView(); return; }
    if(action==='move-entry') { const sec=button.dataset.section,items=currentResume.content[sec],idx=Number(button.dataset.index),to=idx+(button.dataset.dir==='up'?-1:1); if(Array.isArray(items)&&to>=0&&to<items.length){[items[idx],items[to]]=[items[to],items[idx]];renderResumeView()} return; }
    if(action==='move-bullet') { const sec=button.dataset.section,items=currentResume.content[sec],idx=Number(button.dataset.index),bi=Number(button.dataset.bullet),bullets=items?.[idx]?.bullets,to=bi+(button.dataset.dir==='up'?-1:1); if(Array.isArray(bullets)&&to>=0&&to<bullets.length){[bullets[bi],bullets[to]]=[bullets[to],bullets[bi]];renderResumeView()} return; }
    if(action==='move-section') { const sec=button.dataset.section,order=currentResume.content.sectionOrder,idx=order.indexOf(sec),to=idx+(button.dataset.dir==='up'?-1:1); if(to>=0&&to<order.length){[order[idx],order[to]]=[order[to],order[idx]];renderResumeView()} return; }
  }

  function loadImportScript(src, globalName) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-resume-import-lib="' + globalName + '"]');
      const script = existing || document.createElement('script');
      if (!existing) { script.src = src; script.async = true; script.dataset.resumeImportLib = globalName; document.head.appendChild(script); }
      script.addEventListener('load', () => window[globalName] ? resolve(window[globalName]) : reject(new Error('The document reader did not initialize.')), { once: true });
      script.addEventListener('error', () => reject(new Error('Could not load the document reader. Check your connection and try again.')), { once: true });
      if (window[globalName]) resolve(window[globalName]);
    });
  }
  async function extractResumeText(file) {
    if (!file) throw new Error('Choose a PDF or DOCX file first.');
    if (file.size > 15 * 1024 * 1024) throw new Error('Choose a file smaller than 15 MB.');
    const name = String(file.name || '').toLowerCase();
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      // Download the parser and read the selected file at the same time so the
      // user does not pay these two independent costs sequentially.
      const [pdfjs, fileBuffer] = await Promise.all([
        loadImportScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'pdfjsLib'),
        file.arrayBuffer()
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf = await pdfjs.getDocument({ data: fileBuffer }).promise;
      // Read pages concurrently instead of waiting for each page sequentially.
      const pages = await Promise.all(Array.from({ length: pdf.numPages }, async (_, index) => {
        const page = await pdf.getPage(index + 1);
        const content = await page.getTextContent();
        return content.items.map(item => item.str || '').join(' ');
      }));
      return pages.join('\n').trim();
    }
    if (name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const [mammoth, fileBuffer] = await Promise.all([
        loadImportScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js', 'mammoth'),
        file.arrayBuffer()
      ]);
      const result = await mammoth.extractRawText({ arrayBuffer: fileBuffer });
      return String(result.value || '').trim();
    }
    throw new Error('Unsupported file type. Upload a PDF or DOCX document.');
  }
  function renderImportProgress() {
    if (!importBusy) return '';
    const steps = ['Reading your document', 'Organizing details with AI', 'Preparing your review'];
    const active = importStage.includes('Reading') ? 0 : importStage.includes('Organizing') ? 1 : 2;
    return '<div class="rs-import-progress-backdrop" role="presentation"><section class="rs-import-progress" role="dialog" aria-modal="true" aria-labelledby="rsImportProgressTitle" aria-live="polite"><div class="rs-import-progress-mark"><span></span></div><p class="eyebrow">MASTER PROFILE IMPORT</p><h3 id="rsImportProgressTitle">Making your resume ready</h3><p class="rs-import-progress-copy">' + escHtml(importStage) + '</p><div class="rs-import-progress-track"><span></span></div><ol>' + steps.map((label, i) => '<li class="' + (i < active ? 'is-done' : i === active ? 'is-active' : '') + '"><span>' + (i < active ? '✓' : String(i + 1)) + '</span>' + label + '</li>').join('') + '</ol><small>This may take a moment. Keep this window open while we organize your information.</small></section></div>';
  }
  async function startResumeImport(file) {
    importBusy = true; importStage = 'Reading your document…'; importError = ''; importReview = null; render();
    try {
      const text = await extractResumeText(file);
      if (text.replace(/\s/g, '').length < 80) throw new Error('Very little selectable text was found. If this is a scanned PDF, use an OCR-readable PDF or DOCX file.');
      if (text.length > 40000) throw new Error('This resume contains more than 40,000 characters. Upload a shorter version.');
      importStage = 'Organizing details with AI…'; render();
      const endpoint = location.hostname.endsWith('.hatchable.site') ? 'https://alanodogwuideh.com/api/admin-resume-studio' : '/api/admin-resume-studio';
      const result = await api(endpoint, { method: 'POST', body: JSON.stringify({ action: 'import-profile', master_resume_text: text }) });
      if (!result?.profile) throw new Error('The AI service returned no structured profile. Please retry with a text-based PDF or DOCX.');
      importStage = 'Preparing your review…'; render();
      importReview = { profile: result.profile, warnings: result.warnings || [], fileName: file.name, sourceText: text };
      importError = '';
    } catch (error) {
      importError = error.message || 'Could not import this resume. Please try again.';
    } finally { importBusy = false; render(); }
  }
  function normalizeImportedProfile(value) {
    const p = value && typeof value === 'object' ? value : {};
    const normalized = { ...emptyProfile(), ...p };
    normalized.contact = { ...emptyProfile().contact, ...(p.contact || {}) };
    normalized.contact.links = Array.isArray(normalized.contact.links) ? normalized.contact.links : [];
    for (const key of ['summaries','experience','projects','skills','education','certifications']) normalized[key] = Array.isArray(p[key]) ? p[key] : [];
    normalized.summaries = normalized.summaries.map(x => ({ id: uid(), label: clean(x.label), text: clean(x.text) }));
    normalized.experience = normalized.experience.map(x => ({ id: uid(), company: clean(x.company), title: clean(x.title), location: clean(x.location), startDate: clean(x.startDate), endDate: clean(x.endDate), current: !!x.current, bullets: (Array.isArray(x.bullets) ? x.bullets : []).map(b => ({ id: uid(), text: clean(b.text), tags: Array.isArray(b.tags) ? b.tags : [] })) }));
    normalized.projects = normalized.projects.map(x => ({ id: uid(), name: clean(x.name), url: clean(x.url), description: clean(x.description), bullets: (Array.isArray(x.bullets) ? x.bullets : []).map(b => ({ id: uid(), text: clean(b.text), tags: Array.isArray(b.tags) ? b.tags : [] })) }));
    normalized.skills = normalized.skills.map(x => ({ id: uid(), category: clean(x.category), items: Array.isArray(x.items) ? x.items.map(clean) : typeof x.items === 'string' ? splitTags(x.items) : [] }));
    normalized.education = normalized.education.map(x => ({ id: uid(), institution: clean(x.institution), degree: clean(x.degree), field: clean(x.field), startDate: clean(x.startDate), endDate: clean(x.endDate), notes: clean(x.notes) }));
    normalized.certifications = normalized.certifications.map(x => ({ id: uid(), name: clean(x.name), issuer: clean(x.issuer), date: clean(x.date) }));
    normalized.contact.links = normalized.contact.links.map(x => ({ label: clean(x.label), url: clean(x.url) }));
    return normalized;
  }
  function renderImportReview() {
    if (!importReview) return '';
    const p = importReview.profile || {};
    const counts = [
      ['Experience', p.experience?.length || 0], ['Projects', p.projects?.length || 0],
      ['Skill groups', p.skills?.length || 0], ['Education', p.education?.length || 0],
      ['Certifications', p.certifications?.length || 0]
    ];
    const input = (label,path,value,wide=false) => '<label class="rs-field'+(wide?' rs-wide':'')+'"><span>'+label+'</span><input data-import-path="'+path+'" value="'+escHtml(value||'')+'" /></label>';
    const area = (label,path,value) => '<label class="rs-field rs-wide"><span>'+label+'</span><textarea data-import-path="'+path+'" rows="3">'+escHtml(value||'')+'</textarea></label>';
    const contact = p.contact || {};
    const contactHtml = '<section class="rs-import-section"><h4>Contact details</h4><div class="rs-form-grid">'+input('Full name','contact.fullName',contact.fullName)+input('Email','contact.email',contact.email)+input('Phone','contact.phone',contact.phone)+input('Location','contact.location',contact.location)+(contact.links||[]).map((x,i)=>input('Link '+(i+1)+' label','contact.links.'+i+'.label',x.label)+input('Link '+(i+1)+' URL','contact.links.'+i+'.url',x.url)).join('')+'</div></section>';
    const summariesHtml = (p.summaries||[]).length ? '<section class="rs-import-section"><h4>Professional summary</h4>'+(p.summaries||[]).map((x,i)=>'<div class="rs-import-card"><div class="rs-form-grid">'+input('Summary label','summaries.'+i+'.label',x.label)+area('Summary text','summaries.'+i+'.text',x.text)+'</div></div>').join('')+'</section>' : '';
    const experienceHtml = '<section class="rs-import-section"><h4>Work experience</h4>'+((p.experience||[]).length ? p.experience.map((x,i)=>'<article class="rs-import-card"><strong>'+(escHtml(x.title||'Role '+(i+1)))+'</strong><div class="rs-form-grid">'+input('Job title','experience.'+i+'.title',x.title)+input('Company','experience.'+i+'.company',x.company)+input('Location','experience.'+i+'.location',x.location)+input('Start date','experience.'+i+'.startDate',x.startDate)+input('End date','experience.'+i+'.endDate',x.endDate)+area('Achievements / responsibilities (one per line)','experience.'+i+'._bullets',(x.bullets||[]).map(b=>b.text||'').join('\n'))+'</div></article>').join('') : '<p class="rs-import-empty">No work experience was detected.</p>')+'</section>';
    const projectsHtml = '<section class="rs-import-section"><h4>Projects</h4>'+((p.projects||[]).length ? p.projects.map((x,i)=>'<article class="rs-import-card"><div class="rs-form-grid">'+input('Project name','projects.'+i+'.name',x.name)+input('Project URL','projects.'+i+'.url',x.url)+area('Description','projects.'+i+'.description',x.description)+area('Project achievements (one per line)','projects.'+i+'._bullets',(x.bullets||[]).map(b=>b.text||'').join('\n'))+'</div></article>').join('') : '<p class="rs-import-empty">No projects were detected.</p>')+'</section>';
    const skillsHtml = '<section class="rs-import-section"><h4>Skills</h4>'+((p.skills||[]).length ? p.skills.map((x,i)=>'<div class="rs-import-card"><div class="rs-form-grid">'+input('Skill group','skills.'+i+'.category',x.category)+area('Skills (comma-separated)','skills.'+i+'._items',Array.isArray(x.items)?x.items.join(', '):x.items)+'</div></div>').join('') : '<p class="rs-import-empty">No skill groups were detected.</p>')+'</section>';
    const educationHtml = '<section class="rs-import-section"><h4>Education</h4>'+((p.education||[]).length ? p.education.map((x,i)=>'<div class="rs-import-card"><div class="rs-form-grid">'+input('Institution','education.'+i+'.institution',x.institution)+input('Qualification','education.'+i+'.degree',x.degree)+input('Field of study','education.'+i+'.field',x.field)+input('Start date','education.'+i+'.startDate',x.startDate)+input('End date','education.'+i+'.endDate',x.endDate)+area('Notes','education.'+i+'.notes',x.notes)+'</div></div>').join('') : '<p class="rs-import-empty">No education details were detected.</p>')+'</section>';
    const certHtml = '<section class="rs-import-section"><h4>Certifications</h4>'+((p.certifications||[]).length ? p.certifications.map((x,i)=>'<div class="rs-import-card"><div class="rs-form-grid">'+input('Certification','certifications.'+i+'.name',x.name)+input('Issuer','certifications.'+i+'.issuer',x.issuer)+input('Date','certifications.'+i+'.date',x.date)+'</div></div>').join('') : '<p class="rs-import-empty">No certifications were detected.</p>')+'</section>';
    return '<div class="rs-import-backdrop" data-import-action="dismiss"><section class="rs-import-modal" role="dialog" aria-modal="true" aria-labelledby="rsImportTitle"><header><div><span class="eyebrow">MASTER PROFILE IMPORT</span><h3 id="rsImportTitle">Review extracted information</h3><p>Review the information in normal form fields. Correct anything that is misplaced before applying it.</p></div><button type="button" class="rs-analysis-close" data-import-action="dismiss" aria-label="Close import review">×</button></header><div class="rs-import-modal-body"><div class="rs-import-counts">' + counts.map(([label,count]) => '<div><strong>' + count + '</strong><span>' + label + '</span></div>').join('') + '</div>' + ((importReview.warnings || []).length ? '<div class="rs-import-warnings"><strong>Items to verify</strong><ul>' + importReview.warnings.map(w => '<li>' + escHtml(w) + '</li>').join('') + '</ul></div>' : '<p class="rs-import-ok">Still verify the extracted details below.</p>') + contactHtml + summariesHtml + experienceHtml + projectsHtml + skillsHtml + educationHtml + certHtml + '<p class="rs-import-note">Applying these details only updates the unsaved Master Profile form. Nothing is saved until you click Save Master Profile.</p></div><footer><button type="button" class="secondary" data-import-action="dismiss">Cancel</button><button type="button" class="primary" data-import-action="apply">Apply imported profile</button></footer></section></div>';
  }
  function render() {
    if (activeView === 'resumes') { renderResumeView(); return; }
    const wasOpen = currentOpenSections();
    if (openAfterRender) wasOpen.add(openAfterRender);
    const dirty = JSON.stringify(profile) !== savedJson;
    root.innerHTML = '<div class="rs-header"><div><div class="eyebrow">CAREER WORKSPACE</div><h2 id="resumeStudioHeading">Resume Studio</h2><p class="muted">Build one accurate master profile, then reuse it across tailored resumes and cover letters.</p></div><div class="rs-header-status"><span class="rs-status-dot ' + (dirty ? 'is-dirty' : '') + '"></span><span id="rsSaveState">' + (dirty ? 'Unsaved changes' : formatSaved(lastSavedAt)) + '</span></div></div>' +
      '<button type="button" class="rs-mobile-nav-toggle" aria-expanded="false" aria-controls="rsStudioTabs"><span aria-hidden="true">☰</span><span>Resume Studio menu</span></button><div id="rsStudioTabs" class="rs-tabs" role="tablist" aria-label="Resume Studio sections"><button type="button" class="rs-tab is-active" data-resume-view="profile" role="tab" aria-selected="true">Master Profile</button><button type="button" class="rs-tab" disabled title="Coming soon">Jobs <span>Coming soon</span></button><button type="button" class="rs-tab" data-resume-view="resumes" role="tab" aria-selected="false">Resumes</button><button type="button" class="rs-tab" disabled title="Coming soon">Cover Letters <span>Coming soon</span></button></div>' +
      '<div class="rs-intro-row"><div><h3>Master Profile</h3><p>Store verified career facts here. Future AI features will use this information as their source of truth.</p></div><div class="rs-import-actions"><div class="rs-profile-count">' + profile.experience.length + ' roles <span>·</span> ' + profile.projects.length + ' projects</div><input id="rsImportFile" type="file" accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" hidden><button type="button" class="secondary" data-action="import-resume" ' + (importBusy ? 'disabled' : '') + '>' + (importBusy ? 'Importing…' : 'Import existing resume') + '</button></div></div>' +
      (importError ? '<div class="rs-notice rs-import-error"><p>' + escHtml(importError) + '</p></div>' : '') +
      '<div class="rs-notice"><span class="rs-notice-icon" aria-hidden="true">i</span><p>Enter only information you can verify. You can leave fields blank and complete the profile over time. Nothing is published to your public portfolio by saving here.</p></div>' +
      section('contact','Contact details','Name, email, location and professional links', '<div class="rs-form-grid">' + field('contact.fullName','Full name',profile.contact.fullName,{max:160}) + field('contact.email','Email address',profile.contact.email,{kind:'email',max:254}) + field('contact.phone','Phone number',profile.contact.phone,{kind:'tel',max:80}) + field('contact.location','Location',profile.contact.location,{max:160}) + '</div><div class="rs-list-head"><div><strong>Professional links</strong><p>Portfolio, LinkedIn, case studies or other relevant links.</p></div><button type="button" class="rs-small-button" data-action="add-link">+ Add link</button></div>' + (profile.contact.links.length ? profile.contact.links.map((link,i) => '<div class="rs-link-row">' + field('contact.links.'+i+'.label','Link label',link.label,{max:80,placeholder:'LinkedIn'}) + field('contact.links.'+i+'.url','URL',link.url,{kind:'url',max:500,placeholder:'https://...'}) + '<button type="button" class="rs-remove" data-action="remove-link" data-index="'+i+'">Remove</button></div>').join('') : emptyState('No links added yet.')) ,wasOpen.has('contact') || wasOpen.size === 0) +
      section('summaries','Professional summaries','Keep multiple versions for different roles', '<div class="rs-list-head"><div><strong>Summary options</strong><p>Use a short, factual introduction. Label each version for easy selection later.</p></div><button type="button" class="rs-small-button" data-action="add-summary">+ Add summary</button></div>' + (profile.summaries.length ? profile.summaries.map((item,i) => '<article class="rs-item-card"><div class="rs-item-head"><span class="rs-item-index">' + (i+1) + '</span><div class="rs-item-title"><strong>' + escHtml(item.label || 'Untitled summary') + '</strong><small>Summary ' + (i+1) + '</small></div>' + actions('summary',i,profile.summaries.length) + '</div><div class="rs-form-grid">' + field('summaries.'+i+'.label','Summary label',item.label,{max:120,placeholder:'Product design roles'}) + field('summaries.'+i+'.text','Summary text',item.text,{kind:'textarea',wide:true,max:2500,rows:4,placeholder:'A concise summary of your experience, strengths, and relevant focus.'}) + '</div></article>').join('') : emptyState('Add your first summary when you are ready.')) ,wasOpen.has('summaries')) +
      section('experience','Work experience','Roles, dates and achievement bullets', '<div class="rs-list-head"><div><strong>Experience</strong><p>Use your official title, employer and dates. Mark a role as current where applicable.</p></div><button type="button" class="rs-small-button" data-action="add-experience">+ Add role</button></div>' + (profile.experience.length ? profile.experience.map((item,i) => '<article class="rs-item-card"><div class="rs-item-head"><span class="rs-item-index">' + (i+1) + '</span><div class="rs-item-title"><strong>' + escHtml(item.title || 'Untitled role') + '</strong><small>' + escHtml(item.company || 'Employer not entered') + '</small></div>' + actions('experience',i,profile.experience.length) + '</div><div class="rs-form-grid">' + field('experience.'+i+'.company','Company',item.company,{max:180}) + field('experience.'+i+'.title','Job title',item.title,{max:180}) + field('experience.'+i+'.location','Location / work mode',item.location,{max:160,placeholder:'Abuja · Remote'}) + field('experience.'+i+'.startDate','Start date',item.startDate,{max:40,placeholder:'Sep 2024'}) + field('experience.'+i+'.endDate','End date',item.endDate,{max:40,placeholder:'Present'}) + '<div class="rs-current-role">' + check('experience.'+i+'.current','I currently work here',item.current) + '</div></div>' + bulletEditor('experience',i,item.bullets) + '</article>').join('') : emptyState('Add your most recent role first.')) ,wasOpen.has('experience')) +
      section('projects','Projects','Relevant products, case studies and measurable work', '<div class="rs-list-head"><div><strong>Projects</strong><p>Include projects that demonstrate skills relevant to the roles you want.</p></div><button type="button" class="rs-small-button" data-action="add-project">+ Add project</button></div>' + (profile.projects.length ? profile.projects.map((item,i) => '<article class="rs-item-card"><div class="rs-item-head"><span class="rs-item-index">' + (i+1) + '</span><div class="rs-item-title"><strong>' + escHtml(item.name || 'Untitled project') + '</strong><small>Project ' + (i+1) + '</small></div>' + actions('project',i,profile.projects.length) + '</div><div class="rs-form-grid">' + field('projects.'+i+'.name','Project name',item.name,{max:180}) + field('projects.'+i+'.url','Project URL',item.url,{kind:'url',max:500,placeholder:'https://...'}) + field('projects.'+i+'.description','Short description',item.description,{kind:'textarea',wide:true,max:2000,rows:3}) + '</div>' + bulletEditor('projects',i,item.bullets) + '</article>').join('') : emptyState('Add a relevant product or portfolio project.')) ,wasOpen.has('projects')) +
      section('skills','Skills','Group skills into clear categories', '<div class="rs-list-head"><div><strong>Skill groups</strong><p>Separate each skill with a comma. Use specific names you can support with real experience.</p></div><button type="button" class="rs-small-button" data-action="add-skill">+ Add category</button></div>' + (profile.skills.length ? profile.skills.map((item,i) => '<article class="rs-item-card"><div class="rs-item-head"><span class="rs-item-index">' + (i+1) + '</span><div class="rs-item-title"><strong>' + escHtml(item.category || 'Untitled category') + '</strong><small>' + item.items.length + ' skills</small></div>' + actions('skill',i,profile.skills.length) + '</div><div class="rs-form-grid">' + field('skills.'+i+'.category','Category name',item.category,{max:100,placeholder:'Design tools'}) + field('skills.'+i+'.items','Skills',item.items.join(', '),{max:3000,wide:true,placeholder:'Figma, Prototyping, User research'}) + '</div><div class="rs-skill-chips">' + (item.items.length ? item.items.map(skill => '<span>' + escHtml(skill) + '</span>').join('') : '<small>Skills will appear as tags here.</small>') + '</div></article>').join('') : emptyState('Create categories such as Design, Research, Tools or Technical skills.')) ,wasOpen.has('skills')) +
      section('education','Education','Institutions, qualifications and dates', '<div class="rs-list-head"><div><strong>Education</strong><p>Use the exact qualification and institution details.</p></div><button type="button" class="rs-small-button" data-action="add-education">+ Add education</button></div>' + (profile.education.length ? profile.education.map((item,i) => '<article class="rs-item-card"><div class="rs-item-head"><span class="rs-item-index">' + (i+1) + '</span><div class="rs-item-title"><strong>' + escHtml(item.institution || 'Institution not entered') + '</strong><small>' + escHtml([item.degree,item.field].filter(Boolean).join(' · ') || 'Qualification not entered') + '</small></div>' + actions('education',i,profile.education.length) + '</div><div class="rs-form-grid">' + field('education.'+i+'.institution','Institution',item.institution,{max:180}) + field('education.'+i+'.degree','Degree / qualification',item.degree,{max:180}) + field('education.'+i+'.field','Field of study',item.field,{max:180}) + field('education.'+i+'.startDate','Start date',item.startDate,{max:40}) + field('education.'+i+'.endDate','End date',item.endDate,{max:40}) + field('education.'+i+'.notes','Notes',item.notes,{max:1200}) + '</div></article>').join('') : emptyState('Add education or formal training when ready.')) ,wasOpen.has('education')) +
      section('certifications','Certifications','Professional certificates and credentials', '<div class="rs-list-head"><div><strong>Credentials</strong><p>Include the issuer and completion date where known.</p></div><button type="button" class="rs-small-button" data-action="add-certification">+ Add certification</button></div>' + (profile.certifications.length ? profile.certifications.map((item,i) => '<article class="rs-item-card"><div class="rs-item-head"><span class="rs-item-index">' + (i+1) + '</span><div class="rs-item-title"><strong>' + escHtml(item.name || 'Untitled certification') + '</strong><small>' + escHtml(item.issuer || 'Issuer not entered') + '</small></div>' + actions('certification',i,profile.certifications.length) + '</div><div class="rs-form-grid">' + field('certifications.'+i+'.name','Certification name',item.name,{max:180}) + field('certifications.'+i+'.issuer','Issuing organization',item.issuer,{max:180}) + field('certifications.'+i+'.date','Date earned',item.date,{max:80,placeholder:'2025'}) + '</div></article>').join('') : emptyState('Add certificates that are relevant to your applications.')) ,wasOpen.has('certifications')) +
      '<div class="rs-save-bar"><div><strong id="rsStickyState">' + (dirty ? 'Unsaved changes' : formatSaved(lastSavedAt)) + '</strong><small>Master Profile is private to your admin account.</small></div><button type="button" id="rsSaveButton" class="primary" ' + (saving || !dirty ? 'disabled' : '') + '>' + (saving ? 'Saving…' : 'Save Master Profile') + '</button></div>';
    root.querySelectorAll('.rs-tab').forEach(tab => { if (tab.textContent.trim().startsWith('Resumes')) { tab.removeAttribute('disabled'); tab.innerHTML='Resumes'; tab.dataset.view = 'resumes'; tab.setAttribute('role','tab'); tab.setAttribute('aria-selected','false'); } else if (tab.textContent.trim().startsWith('Master Profile')) { tab.dataset.view = 'profile'; tab.setAttribute('role','tab'); tab.setAttribute('aria-selected','true'); } });
    openAfterRender = '';
    updateSaveState();
    if (importReview) root.insertAdjacentHTML('beforeend', renderImportReview());
    if (importBusy) root.insertAdjacentHTML('beforeend', renderImportProgress());
  }
  function updateSaveState() {
    const dirty = JSON.stringify(profile) !== savedJson;
    const label = saving ? 'Saving…' : saveError ? saveError : dirty ? 'Unsaved changes' : formatSaved(lastSavedAt);
    const state = root.querySelector('#rsSaveState');
    const sticky = root.querySelector('#rsStickyState');
    const button = root.querySelector('#rsSaveButton');
    if (state) state.textContent = label;
    if (sticky) sticky.textContent = label;
    if (button) { button.disabled = saving || !dirty; button.textContent = saving ? 'Saving…' : 'Save Master Profile'; }
    root.querySelector('.rs-status-dot')?.classList.toggle('is-dirty', dirty);
  }
  function markDirty() {
    saveError = '';
    persistLocalDraft();
    updateSaveState();
  }
  async function loadProfile() {
    if (loading || (loaded && !root.dataset.forceReload)) return;
    loading = true;
    root.dataset.forceReload = '';
    root.innerHTML = '<div class="panel rs-loading"><span class="rs-spinner" aria-hidden="true"></span><p>Loading your Master Profile…</p></div>';
    try {
      const result = await api('/admin-resume-profile');
      profile = result.profile || emptyProfile();
      profile.contact = profile.contact || emptyProfile().contact;
      for (const key of ['summaries','experience','projects','skills','education','certifications']) if (!Array.isArray(profile[key])) profile[key] = [];
      profile.experience.forEach(item => { item.id ||= uid(); item.bullets = Array.isArray(item.bullets) ? item.bullets : []; item.bullets.forEach(b => { b.id ||= uid(); b.tags = Array.isArray(b.tags) ? b.tags : []; }); });
      profile.projects.forEach(item => { item.id ||= uid(); item.bullets = Array.isArray(item.bullets) ? item.bullets : []; item.bullets.forEach(b => { b.id ||= uid(); b.tags = Array.isArray(b.tags) ? b.tags : []; }); });
      profile.education.forEach(item => item.id ||= uid());
      profile.certifications.forEach(item => item.id ||= uid());
      savedJson = JSON.stringify(profile);
      lastSavedAt = result.updatedAt || null;
      loaded = true;
      const localDraft = readLocalDraft();
      if (localDraft && JSON.stringify(localDraft.profile) !== savedJson) {
        profile = localDraft.profile;
        profile.contact = profile.contact || emptyProfile().contact;
        for (const key of ['summaries','experience','projects','skills','education','certifications']) if (!Array.isArray(profile[key])) profile[key] = [];
        savedJson = JSON.stringify(result.profile || emptyProfile());
        saveError = 'Recovered browser draft — save to store these edits on the server';
      } else if (localDraft && JSON.stringify(localDraft.profile) === savedJson) clearLocalDraft();
      render();
    } catch (error) {
      root.innerHTML = '<div class="panel rs-error"><h3>Could not load Master Profile</h3><p>' + escHtml(error.message || 'Please try again.') + '</p><button type="button" class="secondary" id="rsRetryLoad">Retry</button></div>';
      root.querySelector('#rsRetryLoad')?.addEventListener('click', () => { loaded = false; void loadProfile(); });
    } finally { loading = false; }
  }
  async function saveProfile() {
    if (saving || JSON.stringify(profile) === savedJson) return;
    saving = true;
    updateSaveState();
    const button = root.querySelector('#rsSaveButton');
    if (button) button.disabled = true;
    try {
      const result = await api('/admin-resume-profile', { method: 'PUT', body: JSON.stringify({ profile }) });
      profile = result.profile || profile;
      savedJson = JSON.stringify(profile);
      lastSavedAt = result.updatedAt || new Date().toISOString();
      saveError = '';
      clearLocalDraft();
      render();
      if (typeof cmsToast === 'function') cmsToast('Master Profile saved.');
    } catch (error) {
      persistLocalDraft();
      saveError = 'Save failed: ' + (error.message || 'The server did not confirm the save.') + ' A recovery draft has been kept in this browser.';
      const state = root.querySelector('#rsSaveState');
      if (state) state.textContent = 'Save failed: ' + saveError;
      const sticky = root.querySelector('#rsStickyState');
      if (sticky) sticky.textContent = 'Save failed: ' + saveError;
    } finally {
      saving = false;
      updateSaveState();
    }
  }
  function newBullet() { return { id: uid(), text: '', tags: [] }; }
  function addEntry(group) {
    const templates = {
      summary: () => ({ label: '', text: '' }),
      experience: () => ({ id: uid(), company: '', title: '', location: '', startDate: '', endDate: '', current: false, bullets: [] }),
      project: () => ({ id: uid(), name: '', url: '', description: '', bullets: [] }),
      skill: () => ({ category: '', items: [] }),
      education: () => ({ id: uid(), institution: '', degree: '', field: '', startDate: '', endDate: '', notes: '' }),
      certification: () => ({ id: uid(), name: '', issuer: '', date: '' })
    };
    const key = group === 'project' ? 'projects' : group === 'skill' ? 'skills' : group === 'certification' ? 'certifications' : group === 'education' ? 'education' : group === 'experience' ? 'experience' : 'summaries';
    profile[key].push(templates[group]());
    openAfterRender = key === 'projects' ? 'projects' : key === 'skills' ? 'skills' : key === 'certifications' ? 'certifications' : key === 'education' ? 'education' : key === 'experience' ? 'experience' : 'summaries';
    markDirty(); render();
  }
  root.addEventListener('change', event => {
    const picker = event.target.closest('[data-resume-template],[data-resume-accent],[data-resume-page-size]');
    if (!picker || !currentResume) return;
    currentResume.content ||= {};
    if (picker.matches('[data-resume-template]')) { const custom=window.CustomResumeTemplates?.find(t=>'custom:'+t.id===picker.value); const coreId=/^t(?:[1-9]|1[0-9]|2[0-7])$/.test(picker.value)?picker.value:'t1'; currentResume.content.template = custom ? 'custom:'+custom.id : coreId; if(custom){currentResume.content.accent=custom.config?.accent||'#F8831D';currentResume.content.pageSize=custom.config?.pageSize||'letter';} else { const defaults=window.ResumeTemplates?.get(coreId); if(defaults){currentResume.content.accent=defaults.accent||'#23395B';currentResume.content.pageSize=defaults.pageSize==='a4'?'a4':'letter';} } }
    if (picker.matches('[data-resume-accent]')) currentResume.content.accent = /^#[0-9a-fA-F]{6}$/.test(picker.value)?picker.value:'#23395B';
    if (picker.matches('[data-resume-page-size]')) currentResume.content.pageSize = picker.value==='a4'?'a4':'letter';
    const paper = root.querySelector('#rsResumePreview');
    if (paper) { paper.className = 'rs-resume-paper rs-template-' + (currentResume.content.template||'classic'); paper.style.setProperty('--resume-user-accent',currentResume.content.accent||'#23395B'); paper.style.setProperty('--resume-page-size',currentResume.content.pageSize==='a4'?'210mm 297mm':'8.5in 11in'); paper.innerHTML = resumePreviewHtml(currentResume.content); const ct=window.CustomResumeTemplates?.find(t=>'custom:'+t.id===currentResume.content.template); paper.style.padding=ct?.config?.useCustomDocumentLayout?'0':''; paper.classList.toggle('rs-custom-document-mode',!!ct?.config?.useCustomDocumentLayout); if(ct){const c=ct.config||{};paper.style.fontFamily=c.font||'Arial';paper.style.fontSize=(c.bodySize||10)+'pt';paper.querySelector('.paper-header h1')?.style.setProperty('font-size',(c.nameSize||24)+'pt');paper.querySelector('.paper-header')?.style.setProperty('text-align',c.headerAlign||'center');paper.querySelectorAll('.paper-section').forEach(s=>{s.style.marginTop=(c.spacing||15)+'pt';const h=s.querySelector('h2');if(h){h.style.color=c.accent||'#F8831D';h.style.borderBottom=c.headingStyle==='underline'?'1px solid '+(c.accent||'#F8831D'):'none';if(c.headingStyle==='accent-block'){h.style.background=c.accent||'#F8831D';h.style.color='#fff';h.style.padding='4pt 6pt';}}});paper.querySelectorAll('.paper-skill').forEach(s=>{s.style.borderRadius=c.skillStyle==='pills'?'12pt':'0';s.style.background=c.skillStyle==='pills'?'#eef0f3':'transparent';});if(!c.useCustomDocumentLayout&&window.CVTEAdvanced?.exportHtml&&Array.isArray(c.layout)&&c.layout.length){paper.insertAdjacentHTML('beforeend','<div class="rs-custom-layout-layer" aria-hidden="true">'+window.CVTEAdvanced.exportHtml(c.layout,currentResume.content)+'</div>');}} }
    const sizeLabel=root.querySelector('.rs-preview-label span:last-child'); if(sizeLabel) sizeLabel.textContent=(currentResume.content.pageSize==='a4'?'A4 · 210 × 297 mm':'US LETTER · 8.5 × 11 in');
    const status = root.querySelector('.rs-resume-save-status'); if (status) status.textContent = resumeIsDirty() ? 'Unsaved changes' : 'Saved';
    const save = root.querySelector('[data-resume-action="save"]'); if (save) save.disabled = !resumeIsDirty() || resumeSaving;
  });
  root.addEventListener('input', event => {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement && target.matches('[data-resume-path]')) { target.style.height = 'auto'; target.style.height = Math.max(target.scrollHeight, 42) + 'px'; }
    if (target.matches('[data-resume-path]') && target.type !== 'checkbox' && currentResume) {
      const path = target.dataset.resumePath;
      const value = path === 'title' ? target.value : (path.endsWith('.items') ? splitTags(target.value) : target.value);
      if (path === 'title') currentResume.title = value; else { if (path.startsWith('content.contact.links.0.') && !currentResume.content.contact.links.length) currentResume.content.contact.links.push({label:'Portfolio',url:'',hidden:false}); rpathSet(currentResume, path, value); }
      const preview = root.querySelector('#rsResumePreview'); if (preview) preview.innerHTML = resumePreviewHtml(currentResume.content);
      const status = root.querySelector('.rs-resume-save-status'); if (status) status.textContent = resumeIsDirty() ? 'Unsaved changes' : 'Saved';
      const save = root.querySelector('[data-resume-action=\"save\"]'); if (save) save.disabled = !resumeIsDirty() || resumeSaving;
      return;
    }
    if (!target.matches('[data-path]') || target.type === 'checkbox') return;
    const path = target.dataset.path;
    setPath(path, (target.dataset.kind === 'csv' || (path.startsWith('skills.') && path.endsWith('.items'))) ? splitTags(target.value) : target.value);
    persistLocalDraft();
    if (path.startsWith('skills.') && path.endsWith('.items')) {
      const chips = target.closest('.rs-item-card')?.querySelector('.rs-skill-chips');
      const items = splitTags(target.value);
      if (chips) chips.innerHTML = items.map(item => '<span>' + escHtml(item) + '</span>').join('') || '<small>Skills will appear as tags here.</small>';
    }
    markDirty();
  });
  root.addEventListener('change', event => {
    const target = event.target;
    if (target.matches('[data-resume-path]') && target.type === 'checkbox' && currentResume) {
      const path=target.dataset.resumePath;
      if (path.startsWith('content.hiddenSections.')) { const section=path.split('.').pop(); const list=currentResume.content.hiddenSections||[]; currentResume.content.hiddenSections=target.checked?[...new Set([...list,section])]:list.filter(x=>x!==section); }
      else rpathSet(currentResume,path,target.checked);
      renderResumeView(); return;
    }
    if (!target.matches('[data-path]') || target.type !== 'checkbox') return;
    setPath(target.dataset.path, target.checked);
    persistLocalDraft();
    markDirty();
  });
  root.addEventListener('click', async event => {
    const importControl = event.target.closest('[data-import-action]');
    if (importControl) {
      // The backdrop carries data-import-action="dismiss" for outside clicks.
      // Ignore bubbled clicks from inside the dialog, otherwise a second click
      // on a field or the modal body accidentally closes the review.
      if (importControl.classList.contains('rs-import-backdrop') && event.target !== importControl) return;
      if (importControl.dataset.importAction === 'dismiss') { importReview = null; render(); return; }
      if (importControl.dataset.importAction === 'apply') {
        const imported = JSON.parse(JSON.stringify(importReview?.profile || {}));
        if (!imported.contact) { alert('The extracted profile is incomplete. Please import the resume again.'); return; }
        const assign = (path,value) => {
          const parts = path.split('.');
          let target = imported;
          for (const part of parts.slice(0,-1)) {
            if (target[part] == null) target[part] = /^\d+$/.test(parts[parts.indexOf(part)+1] || '') ? [] : {};
            target = target[part];
          }
          target[parts[parts.length-1]] = value;
        };
        root.querySelectorAll('[data-import-path]').forEach(field => {
          const path = field.dataset.importPath;
          if (path.endsWith('._bullets')) {
            const key = path.split('.').slice(0,-1).join('.');
            const existing = key.split('.').reduce((obj,part)=>obj?.[part], imported) || [];
            const texts = field.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
            assign(key, texts.map((text,i)=>({id:existing[i]?.id||uid(),text,tags:Array.isArray(existing[i]?.tags)?existing[i].tags:[]})));
          } else if (path.endsWith('._items')) {
            assign(path.slice(0,-7)+'.items', splitTags(field.value));
          } else assign(path, field.value.trim());
        });
        const hasExisting = profile.contact.fullName || profile.contact.email || profile.experience.length || profile.projects.length || profile.skills.length || profile.education.length || profile.certifications.length || profile.summaries.length;
        if (hasExisting && !await confirmDialog('This will replace the current Master Profile fields with the imported information. Your saved server profile will not change until you click Save Master Profile. Continue?',{title:'Replace Master Profile fields',confirmLabel:'Replace',tone:'danger'})) return;
        profile = normalizeImportedProfile(imported);
        importReview = null; importError = ''; openAfterRender = 'contact';
        markDirty(); render();
        return;
      }
    }
    const studioMenu=event.target.closest('.rs-mobile-nav-toggle');
    if(studioMenu){const tabs=root.querySelector('#rsStudioTabs');const open=!tabs?.classList.contains('is-open');tabs?.classList.toggle('is-open',open);studioMenu.setAttribute('aria-expanded',String(open));return;}
    const viewTab=event.target.closest('[data-view], [data-resume-view]');
    if (viewTab) {
      const view=viewTab.dataset.view||viewTab.dataset.resumeView;
      if (view==='resumes') { if (activeView==='resumes' && currentResume && resumeIsDirty() && !await confirmDialog('This resume has unsaved changes. Discard them and return to the resume list?',{title:'Discard resume changes',confirmLabel:'Discard',tone:'danger'})) return; if (JSON.stringify(profile)!==savedJson && !await confirmDialog('Your Master Profile has unsaved changes. Discard them and open Resumes?',{title:'Discard Master Profile changes',confirmLabel:'Discard',tone:'danger'})) return; if (JSON.stringify(profile)!==savedJson) { profile=JSON.parse(savedJson); render(); } activeView='resumes'; currentResume=null; await loadResumeList(); return; }
      if (view==='profile') { if (currentResume && resumeIsDirty() && !await confirmDialog('This resume has unsaved changes. Discard them and return to Master Profile?',{title:'Discard resume changes',confirmLabel:'Discard',tone:'danger'})) return; activeView='profile'; currentResume=null; render(); return; }
    }
    const resumeButton=event.target.closest('[data-resume-action]');
    if (resumeButton) { await resumeAction(resumeButton, event); return; }
    const save = event.target.closest('#rsSaveButton');
    if (save) { await saveProfile(); return; }
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === 'import-resume') { root.querySelector('#rsImportFile')?.click(); return; }
    const index = Number(button.dataset.index);
    const group = button.dataset.group;
    const parentIndex = Number(button.dataset.parentIndex);
    const groupKey = group === 'project' ? 'projects' : group === 'experience' ? 'experience' : group;
    const simpleGroups = {summary:'summaries',experience:'experience',project:'projects',skill:'skills',education:'education',certification:'certifications'};
    if (action.startsWith('add-') && action === 'add-link') {
      profile.contact.links.push({label:'',url:''}); openAfterRender = 'contact';
    } else if (action === 'add-bullet') {
      const list = profile[groupKey]?.[parentIndex]?.bullets;
      if (list) list.push(newBullet());
      openAfterRender = groupKey;
    } else if (action === 'remove-bullet') {
      const list = profile[groupKey]?.[parentIndex]?.bullets;
      if (list && await confirmDialog('Remove this bullet?',{title:'Remove achievement bullet',confirmLabel:'Remove',tone:'danger'})) list.splice(index,1); else return;
      openAfterRender = groupKey;
    } else if (action === 'move-bullet') {
      const list = profile[groupKey]?.[parentIndex]?.bullets;
      const to = index + (button.dataset.dir === 'up' ? -1 : 1);
      if (!list || to < 0 || to >= list.length) return;
      [list[index],list[to]] = [list[to],list[index]]; openAfterRender = groupKey;
    } else if (action === 'remove-link') {
      if (!await confirmDialog('Remove this professional link?',{title:'Remove professional link',confirmLabel:'Remove',tone:'danger'})) return;
      profile.contact.links.splice(index,1); openAfterRender = 'contact';
    } else if (action.startsWith('remove-')) {
      const kind = action.slice(7);
      const key = simpleGroups[kind];
      if (!key || !profile[key] || !profile[key][index]) return;
      if (!await confirmDialog('Remove this ' + kind + '? This change is not saved until you save the profile.',{title:'Remove profile item',confirmLabel:'Remove',tone:'danger'})) return;
      profile[key].splice(index,1);
      openAfterRender = key;
    } else if (action.startsWith('move-')) {
      const kind = action.slice(5);
      const key = simpleGroups[kind];
      const to = index + (button.dataset.dir === 'up' ? -1 : 1);
      if (!key || !profile[key] || to < 0 || to >= profile[key].length) return;
      [profile[key][index],profile[key][to]] = [profile[key][to],profile[key][index]];
      openAfterRender = key;
    } else if (action.startsWith('add-')) {
      const kind = action.slice(4);
      if (!simpleGroups[kind]) return;
      addEntry(kind);
      return;
    } else return;
    markDirty(); render();
  });
  root.addEventListener('input', event => {
    const field=event.target.closest('[data-suggestion-index]');
    if (!field) return;
    const index=Number(field.dataset.suggestionIndex);
    if (resumeSuggestions[index]) { resumeSuggestions[index].text=field.value; persistResumeReview(); }
  });
  root.addEventListener('change', event => {
    if (event.target.matches('#rsImportFile')) {
      const file = event.target.files?.[0];
      if (file) void startResumeImport(file);
      event.target.value = '';
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && importReview) { importReview = null; render(); return; }
    if (event.key === 'Escape' && resumeAnalysisOpen) { resumeAnalysisOpen=false; persistResumeReview(); renderResumeView(); }
  });
  document.addEventListener('scroll', updateEditorToolbarStickiness, {capture:true,passive:true});
  window.addEventListener('resize', updateEditorToolbarStickiness, {passive:true});
  document.addEventListener('resume-studio-open', () => { void loadProfile(); });
  document.addEventListener('click', async event => {
    const tab = event.target.closest('.tab[data-tab]');
    const profileDirty = JSON.stringify(profile) !== savedJson;
    const resumeDirty = activeView === 'resumes' && resumeIsDirty();
    if (!tab || (!profileDirty && !resumeDirty)) return;
    if (!await confirmDialog(profileDirty ? 'You have unsaved Master Profile changes. Leave this section and discard them?' : 'You have unsaved resume changes. Leave this section and discard them?',{title:'Discard unsaved changes',confirmLabel:'Discard',tone:'danger'})) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (profileDirty) { profile = JSON.parse(savedJson); saveError = ''; }
    if (resumeDirty && currentResume) { currentResume.content = JSON.parse(resumeSavedJson); currentResume.title = resumeSavedTitle; }
    render();
  }, true);
  window.addEventListener('beforeunload', event => {
    if ((loaded && JSON.stringify(profile) !== savedJson) || (activeView === 'resumes' && resumeIsDirty())) { event.preventDefault(); event.returnValue = ''; }
  });
  root.innerHTML = '<div class="panel rs-loading"><span class="rs-spinner" aria-hidden="true"></span><p>Resume Studio is ready. Open this tab to load your profile.</p></div>';
  if (!document.querySelector('#resumeTab')?.hidden) void loadProfile();
})();