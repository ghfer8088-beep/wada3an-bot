/**
 * Injected into facebook.com to read current logged-in profile name and avatar dynamically
 */
(function() {
  function extractProfile() {
    try {
      let accountName = null;
      let accountUid = null;

      // Method 1: Look for user meta or script data
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        const text = s.textContent || '';
        if (text.includes('CurrentUserInitialData')) {
          const matchName = text.match(/"NAME":"([^"]+)"/);
          const matchId = text.match(/"ACCOUNT_ID":"([^"]+)"/);
          if (matchName) {
            try { accountName = JSON.parse(`"${matchName[1]}"`); } catch (_) { accountName = matchName[1]; }
          }
          if (matchId) accountUid = matchId[1];
          break;
        }
      }

      // Method 2: DOM selectors
      if (!accountName) {
        const nameEl = document.querySelector('div[role="navigation"] svg[aria-label="Your profile"] ~ span') 
                     || document.querySelector('div[role="navigation"] h1')
                     || document.querySelector('a[href*="/profile.php"] span')
                     || document.querySelector('a[href*="facebook.com/me"] span');
        if (nameEl) accountName = nameEl.textContent.trim();
      }

      if (!accountUid) {
        // Try getting from cookies directly or links
        const meLink = document.querySelector('a[href*="/profile.php?id="]');
        if (meLink) {
          const m = meLink.href.match(/id=(\d+)/);
          if (m) accountUid = m[1];
        }
      }

      if (accountName || accountUid) {
        chrome.runtime.sendMessage({
          action: 'SAVE_ACCOUNT_INFO',
          data: {
            connected: true,
            uid: accountUid,
            name: accountName,
            avatar: accountUid ? `https://graph.facebook.com/${accountUid}/picture?type=large` : '',
            lastUpdated: Date.now()
          }
        });
      }
    } catch (e) {
      // Silent catch
    }
  }

  extractProfile();
  setTimeout(extractProfile, 2000);

  function parseMetricNum(str) {
    if (!str) return 0;
    const arabicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    let clean = str;
    arabicDigits.forEach((d, i) => { clean = clean.split(d).join(i.toString()); });
    clean = clean.replace(/٫/g, '.').replace(/,/g, '');
    const m = clean.match(/([\d\.]+)\s*(k|m|ألف|مليون)?/i);
    if (!m) return 0;
    let val = parseFloat(m[1]);
    const unit = (m[2] || '').toLowerCase();
    if (unit === 'k' || unit === 'ألف') val *= 1000;
    if (unit === 'm' || unit === 'مليون') val *= 1000000;
    return Math.round(val);
  }

  // Listen to scan requests from dashboard/background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SCAN_PAGE_POSTS') {
      const extracted = [];
      const articles = document.querySelectorAll('div[role="article"], div[role="feed"] > div');
      articles.forEach((art, index) => {
        try {
          const linkEl = art.querySelector('a[href*="/posts/"], a[href*="/videos/"], a[href*="/reel/"], a[href*="permalink.php"], a[href*="story_fbid"]');
          if (!linkEl) return;
          let url = linkEl.href;
          if (url.includes('?')) url = url.split('&')[0];

          const textEl = art.querySelector('div[data-ad-preview="message"]') || art.querySelector('div[dir="auto"]');
          const snippet = textEl ? textEl.innerText.slice(0, 200).trim() : 'منشور نشط في الصفحة';

          let commentsText = '0 تعليق';
          let commentCount = 0;
          let reactionsText = '0 تفاعل';
          let reactionCount = 0;
          let viewsText = '';
          let viewsCount = 0;

          const allSpans = art.querySelectorAll('span, div');
          for (const s of allSpans) {
            const t = (s.innerText || '').trim();
            if ((t.includes('تعليق') || t.includes('comments') || t.includes('comment')) && !t.includes('اكتب')) {
              commentsText = t;
              commentCount = parseMetricNum(t);
            }
            if (t.includes('إعجاب') || t.includes('تفاعل') || t.includes('likes') || t.includes('reactions')) {
              reactionsText = t;
              reactionCount = parseMetricNum(t);
            }
            if (t.includes('مشاهدة') || t.includes('views')) {
              viewsText = t;
              viewsCount = parseMetricNum(t);
            }
          }

          if (snippet.length > 5 && !extracted.some(p => p.url === url)) {
            extracted.push({
              id: 'scanned_' + index + '_' + Date.now(),
              type: url.includes('/reel/') ? 'reel' : 'post',
              group_name: document.title.split('|')[0].trim() || 'فيسبوك مباشر',
              title: snippet.slice(0, 80) + '...',
              snippet: snippet,
              url: url,
              commentCount: commentCount,
              reactionCount: reactionCount,
              viewsCount: viewsCount,
              engagement: `💬 ${commentsText} • 👍 ${reactionsText}${viewsText ? ' • 👁️ ' + viewsText : ''}`,
              published_at: 'منشور مباشر',
              suggested_angle: 'story'
            });
          }
        } catch (e) {}
      });

      sendResponse({ success: true, posts: extracted });
      return true;
    }
  });
})();
