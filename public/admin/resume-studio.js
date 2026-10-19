(() => {
  const root = document.getElementById('resumeStudioApp');
  if (!root) return;

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2));
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
  const section = (key, title, description, content, isOpen) => '<details class="rs-section" data-section="' + key + '"' + (isOpen ? ' open' : '') + '><summary><span class="rs-section-summary"><strong>' + title + '</strong><small>' + description + '</small></span><span class="rs-chevron" aria-hidden="true">⌄</span></summary><div class="rs-section-body">' + content + '</div></details>';
  const emptyState = text => '<div class="rs-empty-inline">' + escHtml(text) + '</div>';
  function currentOpenSections() {
    return new Set([...root.querySelectorAll('details.rs-section[open]')].map(node => node.dataset.section));
  }
  function render() {
    const wasOpen = currentOpenSections();
    if (openAfterRender) wasOpen.add(openAfterRender);
    const dirty = JSON.stringify(profile) !== savedJson;
    root.innerHTML = '<div class="rs-header"><div><div class="eyebrow">CAREER WORKSPACE</div><h2 id="resumeStudioHeading">Resume Studio</h2><p class="muted">Build one accurate master profile, then reuse it across tailored resumes and cover letters.</p></div><div class="rs-header-status"><span class="rs-status-dot ' + (dirty ? 'is-dirty' : '') + '"></span><span id="rsSaveState">' + (dirty ? 'Unsaved changes' : formatSaved(lastSavedAt)) + '</span></div></div>' +
      '<div class="rs-tabs" role="tablist" aria-label="Resume Studio sections"><button type="button" class="rs-tab is-active" role="tab" aria-selected="true">Master Profile</button><button type="button" class="rs-tab" disabled title="Coming soon">Jobs <span>Coming soon</span></button><button type="button" class="rs-tab" disabled title="Coming soon">Resumes <span>Coming soon</span></button><button type="button" class="rs-tab" disabled title="Coming soon">Cover Letters <span>Coming soon</span></button></div>' +
      '<div class="rs-intro-row"><div><h3>Master Profile</h3><p>Store verified career facts here. Future AI features will use this information as their source of truth.</p></div><div class="rs-profile-count">' + profile.experience.length + ' roles <span>·</span> ' + profile.projects.length + ' projects</div></div>' +
      '<div class="rs-notice"><span class="rs-notice-icon" aria-hidden="true">i</span><p>Enter only information you can verify. You can leave fields blank and complete the profile over time. Nothing is published to your public portfolio by saving here.</p></div>' +
      section('contact','Contact details','Name, email, location and professional links', '<div class="rs-form-grid">' + field('contact.fullName','Full name',profile.contact.fullName,{max:160}) + field('contact.email','Email address',profile.contact.email,{kind:'email',max:254}) + field('contact.phone','Phone number',profile.contact.phone,{kind:'tel',max:80}) + field('contact.location','Location',profile.contact.location,{max:160}) + '</div><div class="rs-list-head"><div><strong>Professional links</strong><p>Portfolio, LinkedIn, case studies or other relevant links.</p></div><button type="button" class="rs-small-button" data-action="add-link">+ Add link</button></div>' + (profile.contact.links.length ? profile.contact.links.map((link,i) => '<div class="rs-link-row">' + field('contact.links.'+i+'.label','Link label',link.label,{max:80,placeholder:'LinkedIn'}) + field('contact.links.'+i+'.url','URL',link.url,{kind:'url',max:500,placeholder:'https://...'}) + '<button type="button" class="rs-remove" data-action="remove-link" data-index="'+i+'">Remove</button></div>').join('') : emptyState('No links added yet.')) ,wasOpen.has('contact') || wasOpen.size === 0) +
      section('summaries','Professional summaries','Keep multiple versions for different roles', '<div class="rs-list-head"><div><strong>Summary options</strong><p>Use a short, factual introduction. Label each version for easy selection later.</p></div><button type="button" class="rs-small-button" data-action="add-summary">+ Add summary</button></div>' + (profile.summaries.length ? profile.summaries.map((item,i) => '<article class="rs-item-card"><div class="rs-item-head"><span class="rs-item-index">' + (i+1) + '</span><div class="rs-item-title"><strong>' + escHtml(item.label || 'Untitled summary') + '</strong><small>Summary ' + (i+1) + '</small></div>' + actions('summary',i,profile.summaries.length) + '</div><div class="rs-form-grid">' + field('summaries.'+i+'.label','Summary label',item.label,{max:120,placeholder:'Product design roles'}) + field('summaries.'+i+'.text','Summary text',item.text,{kind:'textarea',wide:true,max:2500,rows:4,placeholder:'A concise summary of your experience, strengths, and relevant focus.'}) + '</div></article>').join('') : emptyState('Add your first summary when you are ready.')) ,wasOpen.has('summaries')) +
      section('experience','Work experience','Roles, dates and achievement bullets', '<div class="rs-list-head"><div><strong>Experience</strong><p>Use your official title, employer and dates. Mark a role as current where applicable.</p></div><button type="button" class="rs-small-button" data-action="add-experience">+ Add role</button></div>' + (profile.experience.length ? profile.experience.map((item,i) => '<article class="rs-item-card"><div class="rs-item-head"><span class="rs-item-index">' + (i+1) + '</span><div class="rs-item-title"><strong>' + escHtml(item.title || 'Untitled role') + '</strong><small>' + escHtml(item.company || 'Employer not entered') + '</small></div>' + actions('experience',i,profile.experience.length) + '</div><div class="rs-form-grid">' + field('experience.'+i+'.company','Company',item.company,{max:180}) + field('experience.'+i+'.title','Job title',item.title,{max:180}) + field('experience.'+i+'.location','Location / work mode',item.location,{max:160,placeholder:'Abuja · Remote'}) + field('experience.'+i+'.startDate','Start date',item.startDate,{max:40,placeholder:'Sep 2024'}) + field('experience.'+i+'.endDate','End date',item.endDate,{max:40,placeholder:'Present'}) + '<div class="rs-current-role">' + check('experience.'+i+'.current','I currently work here',item.current) + '</div></div>' + bulletEditor('experience',i,item.bullets) + '</article>').join('') : emptyState('Add your most recent role first.')) ,wasOpen.has('experience')) +
      section('projects','Projects','Relevant products, case studies and measurable work', '<div class="rs-list-head"><div><strong>Projects</strong><p>Include projects that demonstrate skills relevant to the roles you want.</p></div><button type="button" class="rs-small-button" data-action="add-project">+ Add project</button></div>' + (profile.projects.length ? profile.projects.map((item,i) => '<article class="rs-item-card"><div class="rs-item-head"><span class="rs-item-index">' + (i+1) + '</span><div class="rs-item-title"><strong>' + escHtml(item.name || 'Untitled project') + '</strong><small>Project ' + (i+1) + '</small></div>' + actions('project',i,profile.projects.length) + '</div><div class="rs-form-grid">' + field('projects.'+i+'.name','Project name',item.name,{max:180}) + field('projects.'+i+'.url','Project URL',item.url,{kind:'url',max:500,placeholder:'https://...'}) + field('projects.'+i+'.description','Short description',item.description,{kind:'textarea',wide:true,max:2000,rows:3}) + '</div>' + bulletEditor('projects',i,item.bullets) + '</article>').join('') : emptyState('Add a relevant product or portfolio project.')) ,wasOpen.has('projects')) +
      section('skills','Skills','Group skills into clear categories', '<div class="rs-list-head"><div><strong>Skill groups</strong><p>Separate each skill with a comma. Use specific names you can support with real experience.</p></div><button type="button" class="rs-small-button" data-action="add-skill">+ Add category</button></div>' + (profile.skills.length ? profile.skills.map((item,i) => '<article class="rs-item-card"><div class="rs-item-head"><span class="rs-item-index">' + (i+1) + '</span><div class="rs-item-title"><strong>' + escHtml(item.category || 'Untitled category') + '</strong><small>' + item.items.length + ' skills</small></div>' + actions('skill',i,profile.skills.length) + '</div><div class="rs-form-grid">' + field('skills.'+i+'.category','Category name',item.category,{max:100,placeholder:'Design tools'}) + field('skills.'+i+'.items','Skills',item.items.join(', '),{max:3000,wide:true,placeholder:'Figma, Prototyping, User research'}) + '</div><div class="rs-skill-chips">' + (item.items.length ? item.items.map(skill => '<span>' + escHtml(skill) + '</span>').join('') : '<small>Skills will appear as tags here.</small>') + '</div></article>').join('') : emptyState('Create categories such as Design, Research, Tools or Technical skills.')) ,wasOpen.has('skills')) +
      section('education','Education','Institutions, qualifications and dates', '<div class="rs-list-head"><div><strong>Education</strong><p>Use the exact qualification and institution details.</p></div><button type="button" class="rs-small-button" data-action="add-education">+ Add education</button></div>' + (profile.education.length ? profile.education.map((item,i) => '<article class="rs-item-card"><div class="rs-item-head"><span class="rs-item-index">' + (i+1) + '</span><div class="rs-item-title"><strong>' + escHtml(item.institution || 'Institution not entered') + '</strong><small>' + escHtml([item.degree,item.field].filter(Boolean).join(' · ') || 'Qualification not entered') + '</small></div>' + actions('education',i,profile.education.length) + '</div><div class="rs-form-grid">' + field('education.'+i+'.institution','Institution',item.institution,{max:180}) + field('education.'+i+'.degree','Degree / qualification',item.degree,{max:180}) + field('education.'+i+'.field','Field of study',item.field,{max:180}) + field('education.'+i+'.startDate','Start date',item.startDate,{max:40}) + field('education.'+i+'.endDate','End date',item.endDate,{max:40}) + field('education.'+i+'.notes','Notes',item.notes,{max:1200}) + '</div></article>').join('') : emptyState('Add education or formal training when ready.')) ,wasOpen.has('education')) +
      section('certifications','Certifications','Professional certificates and credentials', '<div class="rs-list-head"><div><strong>Credentials</strong><p>Include the issuer and completion date where known.</p></div><button type="button" class="rs-small-button" data-action="add-certification">+ Add certification</button></div>' + (profile.certifications.length ? profile.certifications.map((item,i) => '<article class="rs-item-card"><div class="rs-item-head"><span class="rs-item-index">' + (i+1) + '</span><div class="rs-item-title"><strong>' + escHtml(item.name || 'Untitled certification') + '</strong><small>' + escHtml(item.issuer || 'Issuer not entered') + '</small></div>' + actions('certification',i,profile.certifications.length) + '</div><div class="rs-form-grid">' + field('certifications.'+i+'.name','Certification name',item.name,{max:180}) + field('certifications.'+i+'.issuer','Issuing organization',item.issuer,{max:180}) + field('certifications.'+i+'.date','Date earned',item.date,{max:80,placeholder:'2025'}) + '</div></article>').join('') : emptyState('Add certificates that are relevant to your applications.')) ,wasOpen.has('certifications')) +
      '<div class="rs-save-bar"><div><strong id="rsStickyState">' + (dirty ? 'Unsaved changes' : formatSaved(lastSavedAt)) + '</strong><small>Master Profile is private to your admin account.</small></div><button type="button" id="rsSaveButton" class="primary" ' + (saving || !dirty ? 'disabled' : '') + '>' + (saving ? 'Saving…' : 'Save Master Profile') + '</button></div>';
    openAfterRender = '';
    updateSaveState();
  }
  function updateSaveState() {
    const dirty = JSON.stringify(profile) !== savedJson;
    const label = saving ? 'Saving…' : saveError ? 'Save failed: ' + saveError : dirty ? 'Unsaved changes' : formatSaved(lastSavedAt);
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
        const restore = confirm('A local recovery draft from this browser was found and differs from the saved Master Profile. Restore that draft into the editor? Choose Cancel to keep the version currently saved on the server.');
        if (restore) {
          profile = localDraft.profile;
          profile.contact = profile.contact || emptyProfile().contact;
          for (const key of ['summaries','experience','projects','skills','education','certifications']) if (!Array.isArray(profile[key])) profile[key] = [];
          savedJson = JSON.stringify(result.profile || emptyProfile());
          saveError = 'Recovered local draft — save it to store it on the server';
        } else clearLocalDraft();
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
      saveError = (error.message || 'The server did not confirm the save.') + ' A recovery draft has been kept in this browser.';
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
  root.addEventListener('input', event => {
    const target = event.target;
    if (!target.matches('[data-path]') || target.type === 'checkbox') return;
    const path = target.dataset.path;
    setPath(path, target.dataset.kind === 'csv' ? splitTags(target.value) : target.value);
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
    if (!target.matches('[data-path]') || target.type !== 'checkbox') return;
    setPath(target.dataset.path, target.checked);
    persistLocalDraft();
    markDirty();
  });
  root.addEventListener('click', async event => {
    const save = event.target.closest('#rsSaveButton');
    if (save) { await saveProfile(); return; }
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
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
      if (list && await confirm('Remove this bullet?')) list.splice(index,1); else return;
      openAfterRender = groupKey;
    } else if (action === 'move-bullet') {
      const list = profile[groupKey]?.[parentIndex]?.bullets;
      const to = index + (button.dataset.dir === 'up' ? -1 : 1);
      if (!list || to < 0 || to >= list.length) return;
      [list[index],list[to]] = [list[to],list[index]]; openAfterRender = groupKey;
    } else if (action === 'remove-link') {
      if (!await confirm('Remove this professional link?')) return;
      profile.contact.links.splice(index,1); openAfterRender = 'contact';
    } else if (action.startsWith('remove-')) {
      const kind = action.slice(7);
      const key = simpleGroups[kind];
      if (!key || !profile[key] || !profile[key][index]) return;
      if (!await confirm('Remove this ' + kind + '? This change is not saved until you save the profile.')) return;
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
  document.addEventListener('resume-studio-open', () => { void loadProfile(); });
  document.addEventListener('click', event => {
    const tab = event.target.closest('.tab[data-tab]');
    if (!tab || !JSON.stringify(profile) || JSON.stringify(profile) === savedJson) return;
    if (!confirm('You have unsaved Master Profile changes. Leave this section and discard them?')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    profile = JSON.parse(savedJson);
    saveError = '';
    render();
  }, true);
  window.addEventListener('beforeunload', event => {
    if (loaded && JSON.stringify(profile) !== savedJson) { event.preventDefault(); event.returnValue = ''; }
  });
  root.innerHTML = '<div class="panel rs-loading"><span class="rs-spinner" aria-hidden="true"></span><p>Resume Studio is ready. Open this tab to load your profile.</p></div>';
})();