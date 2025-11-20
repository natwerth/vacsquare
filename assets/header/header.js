    (function() {
      const hdr = document.querySelector('[data-js="site-header"]');
      const menuBtn = document.getElementById('menuToggle');
      const panel = document.getElementById('siteMenu');
      const overlay = document.querySelector('[data-js="overlay"]');
      const DESKTOP_BP = 900; // keep in sync with CSS

      // Active link highlighting for both desktop and mobile
      const path = location.pathname.replace(/\/$/, '');
      const links = Array.from(document.querySelectorAll('.site-header__link, .site-header__panel-link'));
      links.forEach(a => {
        const href = a.getAttribute('href').replace(/\/$/, '');
        if ((href === '' && path === '') || (href !== '' && path.startsWith(href))) {
          a.setAttribute('aria-current', 'page');
        }
      });

      // Sticky shadow on scroll
      const onScroll = () => {
        if (window.scrollY > 4) hdr.classList.add('is-scrolled');
        else hdr.classList.remove('is-scrolled');
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });

      // Menu open/close
      const openMenu = () => {
        if (hdr.getAttribute('data-open') === 'true') return;
        hdr.setAttribute('data-open', 'true');
        panel.hidden = false;
        menuBtn.setAttribute('aria-expanded', 'true');
        menuBtn.setAttribute('aria-label', 'Close menu');
        document.body.classList.add('is-locked');
        // focus first link in panel
        const first = panel.querySelector('a, button, [tabindex]:not([tabindex="-1"])');
        first && first.focus({ preventScroll: true });
      };

      const closeMenu = () => {
        if (hdr.getAttribute('data-open') !== 'true') return;
        hdr.setAttribute('data-open', 'false');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.setAttribute('aria-label', 'Open menu');
        document.body.classList.remove('is-locked');
        // delay hiding to allow transition to finish
        setTimeout(() => { panel.hidden = true; }, 220);
        menuBtn.focus({ preventScroll: true });
      };

      menuBtn.addEventListener('click', () => {
        hdr.getAttribute('data-open') === 'true' ? closeMenu() : openMenu();
      });

      overlay.addEventListener('click', closeMenu);

      panel.addEventListener('click', e => {
        const a = e.target.closest('a');
        if (a) closeMenu();
      });

      // Escape closes
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeMenu();
      });

      // Focus trap in panel when open
      document.addEventListener('keydown', e => {
        if (hdr.getAttribute('data-open') !== 'true' || e.key !== 'Tab') return;
        const focusables = panel.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      });

      // Close if resized to desktop
      const onResize = () => {
        if (window.innerWidth >= DESKTOP_BP) closeMenu();
      };
      window.addEventListener('resize', onResize);

    })();