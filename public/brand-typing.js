(() => {
  const brands = document.querySelectorAll('.brand-typing');
  if (!brands.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fullName = ' Odogwuideh';

  brands.forEach((brand) => {
    const fixed = brand.querySelector('.brand-fixed');
    const rest = brand.querySelector('.brand-rest');
    const measure = brand.querySelector('.brand-measure');
    if (!fixed || !rest || !measure) return;

    const reserveWidth = () => {
      const total = Math.ceil(fixed.getBoundingClientRect().width + measure.getBoundingClientRect().width);
      brand.style.setProperty('--brand-total-width', `${total}px`);
    };

    reserveWidth();
    if (document.fonts?.ready) document.fonts.ready.then(reserveWidth);
    window.addEventListener('resize', reserveWidth);

    if (reduced) {
      rest.textContent = fullName;
      return;
    }

    let timer;
    let index = 0;
    let phase = 'waiting';

    const clear = () => {
      if (timer) window.clearTimeout(timer);
    };

    const step = () => {
      if (phase === 'typing') {
        index += 1;
        rest.textContent = fullName.slice(0, index);
        if (index < fullName.length) {
          timer = window.setTimeout(step, 105);
        } else {
          phase = 'holding';
          timer = window.setTimeout(step, 8000);
        }
        return;
      }

      if (phase === 'holding') {
        phase = 'erasing';
        timer = window.setTimeout(step, 80);
        return;
      }

      if (phase === 'erasing') {
        index -= 1;
        rest.textContent = fullName.slice(0, Math.max(0, index));
        if (index > 0) {
          timer = window.setTimeout(step, 65);
        } else {
          phase = 'waiting';
          timer = window.setTimeout(step, 1000);
          phase = 'typing';
        }
      }
    };

    clear();
    timer = window.setTimeout(() => {
      phase = 'typing';
      step();
    }, 1000);
  });
})();