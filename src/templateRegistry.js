import { renderLeftRailClassic } from './templates/left-rail-classic';

const templatesRegistry = {
  'left-rail-classic': renderLeftRailClassic,
  // As you build out your remaining 26 templates, import and add them here
};

export function compileLayout(templateId, data) {
  const renderer = templatesRegistry[templateId] || templatesRegistry['left-rail-classic'];
  return renderer(data);
}
