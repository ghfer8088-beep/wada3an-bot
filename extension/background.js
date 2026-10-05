/**
 * GrowthEngine Meta Suite Pro - Extension Background Service Worker
 * Fully Dynamic Multi-Account Detection and Live Comment Automation
 */

async function getFacebookSession() {
  try {
    const cookie = await chrome.cookies.get({ url: 'https://www.facebook.com', name: 'c_user' });
    if (!cookie || !cookie.value) {
      return { connected: false, message: 'لم يتم تسجيل الدخول إلى فيسبوك في هذا المتصفح' };
    }

    const uid = cookie.value;

    // 1. Check if we already cached this specific UID's profile
    const cached = await chrome.storage.local.get(['account_' + uid]);
    if (cached && cached['account_' + uid] && cached['account_' + uid].name) {
      return cached['account_' + uid];
    }

    // 2. Fetch live name from Facebook HTML using active session
    let detectedName = null;
    try {
      const response = await fetch('https://www.facebook.com/', {
        credentials: 'include',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml'
        }
      });
      const html = await response.text();

      // Extract NAME from CurrentUserInitialData
      const nameMatch = html.match(/"NAME":"([^"]+)"/);
      if (nameMatch && nameMatch[1]) {
        try {
          detectedName = JSON.parse(`"${nameMatch[1]}"`);
        } catch (_) {
          detectedName = nameMatch[1];
        }
      }

      if (!detectedName) {
        const shortMatch = html.match(/"short_name":"([^"]+)"/);
        if (shortMatch && shortMatch[1]) {
          try {
            detectedName = JSON.parse(`"${shortMatch[1]}"`);
          } catch (_) {
            detectedName = shortMatch[1];
          }
        }
      }
    } catch (e) {
      console.warn('Background fetch for name failed:', e);
    }

    const session = {
      connected: true,
      uid: uid,
      name: detectedName || `حساب فيسبوك النشط (${uid.slice(-4)})`,
      avatar: `https://graph.facebook.com/${uid}/picture?type=large`,
      lastSeen: new Date().toISOString()
    };

    // Cache under this specific account UID
    await chrome.storage.local.set({
      ['account_' + uid]: session,
      activeAccount: session
    });

    // Auto-report session to local dashboard backend server
    try {
      fetch('http://localhost:3000/api/growth-engine/register-active-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: uid,
          name: session.name,
          avatar: session.avatar
        })
      }).catch(() => {});
    } catch (_) {}

    return session;
  } catch (err) {
    console.error('Error in getFacebookSession:', err);
    return { connected: false, error: err.message };
  }
}

// Injected function to write comment directly inside the active Facebook tab
function autoCommentOnFacebookPage(commentText) {
  return new Promise((resolve) => {
    try {
      let attempts = 0;
      const maxAttempts = 24; // 24 * 500ms = 12 seconds polling

      const interval = setInterval(async () => {
        attempts++;

        // 1. Look for any closed comments drawer buttons (reels/theater videos)
        const openCommentBtns = Array.from(document.querySelectorAll('div[role="button"], span[role="button"], [aria-label]'))
          .filter(b => {
            const l = (b.getAttribute('aria-label') || '').toLowerCase();
            return (l.includes('comment') || l.includes('تعليق')) && !l.includes('write') && !l.includes('اكتب') && !l.includes('إرسال');
          });

        if (openCommentBtns.length > 0 && !document.querySelector('div[role="textbox"]')) {
          try { openCommentBtns[0].click(); } catch (_) {}
        }

        // 2. Look for comment placeholder triggers ("اكتب تعليقاً...")
        const placeholders = document.querySelectorAll(
          'div[aria-label*="اكتب تعليقاً"], div[aria-label*="Write a comment"], div[aria-label*="اكتب تعليقاً عاماً"], div[aria-label*="Write a public comment"], div[aria-placeholder*="تعليق"], div[aria-placeholder*="comment"]'
        );
        if (placeholders.length > 0 && !document.activeElement?.getAttribute('role')?.includes('textbox')) {
          try {
            placeholders[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
            placeholders[0].click();
            placeholders[0].focus();
          } catch (_) {}
        }

        // 3. Find active contenteditable textbox
        const box = document.querySelector('div[role="textbox"][contenteditable="true"]')
                 || document.querySelector('form div[role="textbox"]')
                 || document.querySelector('div[contenteditable="true"][data-lexical-editor="true"]')
                 || document.querySelector('div[contenteditable="true"]');

        if (box) {
          clearInterval(interval);
          try {
            box.scrollIntoView({ block: 'center', behavior: 'smooth' });
            box.focus();

            // Insert text via multiple fallback methods
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, commentText);

            if (!box.textContent.includes(commentText.slice(0, 10))) {
              const p = box.querySelector('p') || box;
              p.textContent = commentText;
            }

            // Dispatch React/Lexical events
            box.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: commentText }));
            box.dispatchEvent(new Event('input', { bubbles: true }));
            box.dispatchEvent(new Event('change', { bubbles: true }));

            // Wait 600ms for React state to enable the submit button
            setTimeout(() => {
              // Try finding submit / send button
              const parentForm = box.closest('form') || box.closest('div[role="presentation"]') || box.parentElement?.parentElement?.parentElement;
              let sendBtn = null;
              if (parentForm) {
                sendBtn = parentForm.querySelector('div[role="button"][aria-label*="تعليق"], div[role="button"][aria-label*="Comment"], div[role="button"][aria-label*="نشر"], div[role="button"][aria-label*="Post"], div[role="button"][aria-label*="إرسال"], div[role="button"][aria-label*="Send"], [aria-label*="Enter to send"]');
                if (!sendBtn) {
                  const allBtns = Array.from(parentForm.querySelectorAll('div[role="button"]'));
                  sendBtn = allBtns.find(b => {
                    const al = (b.getAttribute('aria-label') || '').toLowerCase();
                    return al.includes('تعليق') || al.includes('comment') || al.includes('send') || al.includes('نشر') || al.includes('post');
                  });
                }
              }

              if (sendBtn) {
                sendBtn.click();
              }

              // Also fire Enter keystrokes
              const enterDown = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
              const enterUp = new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
              box.dispatchEvent(enterDown);
              box.dispatchEvent(enterUp);

              // Inject visual confirmation banner on the Facebook page
              try {
                const toast = document.createElement('div');
                toast.style.cssText = 'position:fixed;top:25px;left:50%;transform:translateX(-50%);background:#059669;color:#fff;padding:12px 26px;border-radius:30px;font-size:15px;font-weight:bold;z-index:99999999;box-shadow:0 10px 25px rgba(0,0,0,0.3);text-align:center;font-family:sans-serif;';
                toast.innerHTML = '🎉 تم إرسال التعليق في المنشور بنجاح!';
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 4000);
              } catch (_) {}

              let postPermalink = window.location.href;
              try {
                const article = box.closest('div[role="article"]') || box.closest('div[role="feed"] > div');
                if (article) {
                  const postLinkEl = article.querySelector('a[href*="/posts/"], a[href*="/permalink/"], a[href*="story_fbid"]');
                  if (postLinkEl && postLinkEl.href) {
                    postPermalink = postLinkEl.href.split('?')[0];
                  }
                }
              } catch (_) {}

              resolve({ success: true, message: 'تم إدخال التعليق وإرساله بنجاح في المنشور!', postUrl: postPermalink });
            }, 600);

          } catch (e) {
            resolve({ success: false, error: e.message });
          }

        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          resolve({ success: false, message: 'تعذر العثور على حقل كتابة التعليق تلقائياً.' });
        }
      }, 500);

    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
}

// Autonomous Background Facebook Scanner for Trending Jordanian Pages
function autoScanFacebookUrl(targetUrl, sourceLabel, sortMode = 'desc') {
  return new Promise((resolve) => {
    chrome.tabs.create({ url: targetUrl, active: false }, (tab) => {
      if (!tab || !tab.id) {
        resolve({ success: false, posts: [] });
        return;
      }

      let finished = false;
      const cleanup = () => {
        if (!finished) {
          finished = true;
          try { chrome.tabs.remove(tab.id); } catch (_) {}
        }
      };

      const timeout = setTimeout(() => {
        cleanup();
        resolve({ success: false, posts: [] });
      }, 22000);

      const listener = (tabId, changeInfo) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);

          // Wait 3.5s for feed to load and trigger dynamic scroll
          setTimeout(async () => {
            try {
              const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async (label, sMode) => {
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

                  window.scrollBy(0, 1000);
                  await new Promise(r => setTimeout(r, 1200));
                  window.scrollBy(0, 1500);
                  await new Promise(r => setTimeout(r, 1200));

                  const extracted = [];
                  const articles = document.querySelectorAll('div[role="article"], div[role="feed"] > div');

                  articles.forEach((art, idx) => {
                    try {
                      const linkEl = art.querySelector('a[href*="/posts/"], a[href*="/videos/"], a[href*="/reel/"], a[href*="permalink.php"], a[href*="story_fbid"]');
                      if (!linkEl) return;
                      let url = linkEl.href;
                      if (url.includes('?')) url = url.split('&')[0];

                      const textEl = art.querySelector('div[data-ad-preview="message"]') || art.querySelector('div[dir="auto"]');
                      const snippet = textEl ? textEl.innerText.slice(0, 200).trim() : '';
                      if (snippet.length < 8) return;

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

                      if (!extracted.some(p => p.url === url)) {
                        extracted.push({
                          id: 'auto_' + idx + '_' + Date.now(),
                          type: url.includes('/reel/') ? 'reel' : 'post',
                          group_name: label,
                          title: snippet.slice(0, 80) + '...',
                          snippet: snippet,
                          url: url,
                          commentCount: commentCount,
                          reactionCount: reactionCount,
                          viewsCount: viewsCount,
                          engagement: `💬 ${commentsText} • 👍 ${reactionsText}${viewsText ? ' • 👁️ ' + viewsText : ''}`,
                          published_at: 'منشور مباشر نشط',
                          suggested_angle: 'story'
                        });
                      }
                    } catch (e) {}
                  });

                  if (sMode === 'asc') {
                    extracted.sort((a, b) => (a.commentCount || 0) - (b.commentCount || 0));
                  } else {
                    extracted.sort((a, b) => (b.commentCount || 0) - (a.commentCount || 0));
                  }
                  return extracted;
                },
                args: [sourceLabel, sortMode]
              });

              clearTimeout(timeout);
              cleanup();

              const posts = results && results[0] && results[0].result ? results[0].result : [];
              resolve({ success: true, posts });
            } catch (err) {
              clearTimeout(timeout);
              cleanup();
              resolve({ success: false, posts: [] });
            }
          }, 3500);
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}

// Listen to messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_FB_ACCOUNT') {
    getFacebookSession().then(data => sendResponse(data));
    return true;
  }

  if (request.action === 'SAVE_ACCOUNT_INFO') {
    if (request.data && request.data.uid) {
      chrome.storage.local.set({
        ['account_' + request.data.uid]: request.data,
        activeAccount: request.data
      });
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'POST_COMMENT_TO_FACEBOOK') {
    (async () => {
      try {
        const tab = await chrome.tabs.create({ url: request.url, active: true });

        const listener = (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);

            setTimeout(async () => {
              try {
                const results = await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: autoCommentOnFacebookPage,
                  args: [request.text]
                });
                const res = results && results[0] ? results[0].result : { success: false };
                sendResponse(res);
              } catch (ex) {
                sendResponse({ success: false, error: ex.message });
              }
            }, 2500);
          }
        };

        chrome.tabs.onUpdated.addListener(listener);
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (request.action === 'SCAN_ACTIVE_TAB_POSTS') {
    chrome.tabs.query({ url: '*://*.facebook.com/*' }, (fbTabs) => {
      if (!fbTabs || fbTabs.length === 0) {
        sendResponse({
          success: false,
          message: 'يرجى فتح لسان فيسبوك (مثل صفحة إخبارية أو مجموعة) في المتصفح أولاً ليقوم الرادار بمسح منشوراته مباشرة.'
        });
        return;
      }

      const targetTab = fbTabs.find(t => t.active) || fbTabs[0];
      chrome.tabs.sendMessage(targetTab.id, { action: 'SCAN_PAGE_POSTS' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          sendResponse({
            success: false,
            message: 'لم يتمكن من قراءة المنشورات في لسان فيسبوك الحالي. جرب تحديث صفحة فيسبوك وإعادة المحاولة.'
          });
        } else {
          sendResponse(response);
        }
      });
    });
    return true;
  }

  if (request.action === 'START_AUTONOMOUS_RADAR_SCAN') {
    (async () => {
      let sources = [];
      const sortMode = request.sort || 'desc';

      if (request.target === 'custom_search' && request.query) {
        sources = [
          {
            url: `https://www.facebook.com/search/posts/?q=${encodeURIComponent(request.query)}&filters=rp_chrono:true`,
            label: `تريند فيسبوك: ${request.query}`
          }
        ];
      } else if (request.target === 'hashtag' && request.query) {
        const cleanTag = request.query.replace('#', '');
        sources = [
          {
            url: `https://www.facebook.com/hashtag/${encodeURIComponent(cleanTag)}`,
            label: `هاشتاج #${cleanTag}`
          },
          {
            url: `https://www.facebook.com/search/posts/?q=%23${encodeURIComponent(cleanTag)}&filters=rp_chrono:true`,
            label: `بحث هاشتاج #${cleanTag}`
          }
        ];
      } else if (request.target === 'my_page') {
        sources = [
          {
            url: 'https://www.facebook.com/30minutes30',
            label: 'صفحة وداعاً للألم - خلدا'
          }
        ];
      } else if (request.target === 'meta_ads' && request.query) {
        sources = [
          {
            url: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=JO&q=${encodeURIComponent(request.query)}`,
            label: `مكتبة إعلانات الأردن: ${request.query}`
          }
        ];
      } else {
        // Default: Top Jordanian News Channels
        sources = [
          { url: 'https://www.facebook.com/RoyaNews', label: 'رؤيا الإخباري (Roya News)' },
          { url: 'https://www.facebook.com/AlMamlakaTV', label: 'قناة المملكة (Al Mamlaka TV)' },
          { url: 'https://www.facebook.com/khaberni', label: 'خبرني (Khaberni)' },
          { url: 'https://www.facebook.com/petranews', label: 'وكالة بترا (Petra News)' }
        ];
      }

      let allFound = [];
      for (const s of sources) {
        try {
          const res = await autoScanFacebookUrl(s.url, s.label, sortMode);
          if (res.success && res.posts && res.posts.length > 0) {
            allFound = allFound.concat(res.posts);
          }
        } catch (_) {}
      }

      if (sortMode === 'asc') {
        allFound.sort((a, b) => (a.commentCount || 0) - (b.commentCount || 0));
      } else {
        allFound.sort((a, b) => (b.commentCount || 0) - (a.commentCount || 0));
      }

      sendResponse({ success: true, posts: allFound });
    })();
    return true;
  }

  // ==========================================
  // Multi-Account Session Cookie Swapping (Metus Architecture)
  // ==========================================

  if (request.action === 'CAPTURE_CURRENT_SESSION') {
    (async () => {
      try {
        const cookies = await chrome.cookies.getAll({ domain: '.facebook.com' });
        const cUserCookie = cookies.find(c => c.name === 'c_user');
        if (!cUserCookie || !cUserCookie.value) {
          sendResponse({ success: false, message: 'لا توجد جلسة فيسبوك نشطة حالياً في المتصفح. تأكد من فتح فيسبوك وتسجيل الدخول أولاً.' });
          return;
        }

        const uid = cUserCookie.value;
        const liveSession = await getFacebookSession();
        const accountName = request.label || liveSession.name || ('حساب ' + uid);

        const accountData = {
          uid: uid,
          name: accountName,
          role: request.role || 'inquirer',
          avatar: `https://graph.facebook.com/${uid}/picture?type=large`,
          cookies: cookies.map(c => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path,
            secure: c.secure,
            httpOnly: c.httpOnly,
            sameSite: c.sameSite
          })),
          savedAt: new Date().toISOString()
        };

        const stored = await chrome.storage.local.get(['savedAccountsList']);
        let list = stored.savedAccountsList || [];
        const existingIdx = list.findIndex(a => a.uid === uid);
        if (existingIdx >= 0) {
          list[existingIdx] = accountData;
        } else {
          list.push(accountData);
        }

        await chrome.storage.local.set({
          savedAccountsList: list,
          activeAccount: accountData
        });

        // Automatically sync to local central server vault (shared across all profiles)
        try {
          fetch('http://localhost:3000/api/growth-engine/save-full-account-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(accountData)
          }).catch(() => {});
        } catch (_) {}

        sendResponse({ success: true, account: accountData, count: list.length });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (request.action === 'SWITCH_FB_ACCOUNT') {
    (async () => {
      try {
        const targetUid = request.uid;
        const stored = await chrome.storage.local.get(['savedAccountsList']);
        let list = stored.savedAccountsList || [];

        // If not found in local storage, check central server vault
        let target = list.find(a => a.uid === targetUid);
        if (!target) {
          try {
            const vRes = await fetch('http://localhost:3000/api/growth-engine/get-all-sessions');
            const vData = await vRes.json();
            if (vData.success && vData.sessions) {
              target = vData.sessions.find(a => a.uid === targetUid);
              if (target) {
                list.push(target);
                await chrome.storage.local.set({ savedAccountsList: list });
              }
            }
          } catch (_) {}
        }

        if (!target || !target.cookies || target.cookies.length === 0) {
          sendResponse({ success: false, message: 'لم يتم العثور على جلسة كوكيز محفوظة لهذا الحساب.' });
          return;
        }

        // 1. Remove current Facebook cookies
        const currentCookies = await chrome.cookies.getAll({ domain: '.facebook.com' });
        for (const c of currentCookies) {
          const url = (c.secure ? 'https://' : 'http://') + c.domain.replace(/^\./, '') + c.path;
          try {
            await chrome.cookies.remove({ url: url, name: c.name });
          } catch (_) {}
        }

        // 2. Inject target account cookies
        for (const c of target.cookies) {
          const url = (c.secure ? 'https://' : 'http://') + (c.domain.startsWith('.') ? c.domain.slice(1) : c.domain) + c.path;
          try {
            await chrome.cookies.set({
              url: url,
              name: c.name,
              value: c.value,
              domain: c.domain,
              path: c.path,
              secure: c.secure,
              httpOnly: c.httpOnly,
              sameSite: c.sameSite
            });
          } catch (_) {}
        }

        await chrome.storage.local.set({ activeAccount: target });
        sendResponse({ success: true, activeAccount: target });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (request.action === 'GET_ALL_SAVED_ACCOUNTS') {
    (async () => {
      const stored = await chrome.storage.local.get(['savedAccountsList']);
      let list = stored.savedAccountsList || [];

      // Auto-merge from central server vault
      try {
        const vRes = await fetch('http://localhost:3000/api/growth-engine/get-all-sessions');
        const vData = await vRes.json();
        if (vData.success && vData.sessions && vData.sessions.length > 0) {
          let updated = false;
          vData.sessions.forEach(s => {
            const exIdx = list.findIndex(a => a.uid === s.uid);
            if (exIdx === -1) {
              list.push(s);
              updated = true;
            } else if (!list[exIdx].cookies || list[exIdx].cookies.length === 0) {
              list[exIdx] = s;
              updated = true;
            }
          });
          if (updated) {
            await chrome.storage.local.set({ savedAccountsList: list });
          }
        }
      } catch (_) {}

      sendResponse({ success: true, accounts: list });
    })();
    return true;
  }

  if (request.action === 'DELETE_SAVED_ACCOUNT') {
    (async () => {
      const stored = await chrome.storage.local.get(['savedAccountsList']);
      let list = stored.savedAccountsList || [];
      list = list.filter(a => a.uid !== request.uid);
      await chrome.storage.local.set({ savedAccountsList: list });
      sendResponse({ success: true, accounts: list });
    })();
    return true;
  }

  // ==========================================
  // Autonomous Multi-Account Campaign Runner (FewFeed Architecture)
  // ==========================================
  let activeCampaign = {
    running: false,
    currentStep: 0,
    totalSteps: 0,
    currentAccount: '',
    status: 'idle',
    message: '',
    logs: []
  };

  async function performCookieSwitch(targetUid) {
    const stored = await chrome.storage.local.get(['savedAccountsList']);
    const list = stored.savedAccountsList || [];
    const target = list.find(a => a.uid === targetUid || a.name === targetUid);
    if (!target || !target.cookies || target.cookies.length === 0) {
      throw new Error('لا توجد كوكيز محفوظة للحساب: ' + targetUid);
    }

    const currentCookies = await chrome.cookies.getAll({ domain: '.facebook.com' });
    for (const c of currentCookies) {
      const url = (c.secure ? 'https://' : 'http://') + c.domain.replace(/^\./, '') + c.path;
      try { await chrome.cookies.remove({ url: url, name: c.name }); } catch (_) {}
    }

    for (const c of target.cookies) {
      const url = (c.secure ? 'https://' : 'http://') + (c.domain.startsWith('.') ? c.domain.slice(1) : c.domain) + c.path;
      try {
        await chrome.cookies.set({
          url: url,
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          secure: c.secure,
          httpOnly: c.httpOnly,
          sameSite: c.sameSite
        });
      } catch (_) {}
    }

    await chrome.storage.local.set({ activeAccount: target });
    return target;
  }

  if (request.action === 'START_AUTONOMOUS_CAMPAIGN') {
    (async () => {
      if (activeCampaign.running) {
        sendResponse({ success: false, message: 'هناك حملة تبديل قيد التشغيل بالفعل.' });
        return;
      }

      const postUrl = request.postUrl;
      const steps = request.steps || [];

      if (!postUrl || steps.length === 0) {
        sendResponse({ success: false, message: 'بيانات الحملة غير مكتملة.' });
        return;
      }

      activeCampaign = {
        running: true,
        currentStep: 0,
        totalSteps: steps.length,
        currentAccount: '',
        status: 'running',
        message: 'بدء تشغيل الحملة الآلية...',
        logs: []
      };

      sendResponse({ success: true, message: 'تم إطلاق الحملة الآلية بنجاح!' });

      // Execute Campaign in Background
      try {
        let workTab = null;
        const fbTabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
        if (fbTabs && fbTabs.length > 0) {
          workTab = fbTabs[0];
        } else {
          workTab = await chrome.tabs.create({ url: postUrl, active: true });
        }

        for (let i = 0; i < steps.length; i++) {
          if (!activeCampaign.running) break;

          const s = steps[i];
          activeCampaign.currentStep = i + 1;
          activeCampaign.currentAccount = s.account_name;
          activeCampaign.message = `[${i + 1}/${steps.length}] جارٍ التبديل التلقائي إلى حساب: ${s.account_name}...`;
          activeCampaign.logs.push(`[${new Date().toLocaleTimeString()}] التبديل إلى حساب ${s.account_name}`);

          // 1. Switch Cookies
          try {
            await performCookieSwitch(s.account_uid || s.account_name);
          } catch (cErr) {
            console.warn('Switch warning:', cErr);
            activeCampaign.logs.push(`تنبيه: تم المتابعة بالحساب الحالي (${cErr.message})`);
          }

          // 2. Navigate / Refresh Tab
          await chrome.tabs.update(workTab.id, { url: postUrl });
          await new Promise(r => setTimeout(r, 6000));

          // 3. Post Comment
          activeCampaign.message = `[${i + 1}/${steps.length}] جارٍ كتابة ونشر دور [${s.account_name}] في المنشور...`;
          try {
            const results = await chrome.scripting.executeScript({
              target: { tabId: workTab.id },
              func: autoCommentOnFacebookPage,
              args: [s.comment_text]
            });
            const scriptRes = results && results[0] ? results[0].result : null;

            if (scriptRes && scriptRes.success) {
              activeCampaign.logs.push(`[${new Date().toLocaleTimeString()}] ✓ تم نشر تعليق ${s.account_name} بنجاح في فيسبوك!`);
              // Report to local server ONLY when verified
              fetch('http://localhost:3000/api/growth-engine/mark-role-executed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  uid: s.account_uid,
                  name: s.account_name,
                  step: s.step || (i + 1),
                  post_url: postUrl
                })
              }).catch(() => {});
            } else {
              activeCampaign.logs.push(`[${new Date().toLocaleTimeString()}] ⚠️ تعذر النشر لـ ${s.account_name}: ${scriptRes?.message || 'لم يستجب حقل التعليق'}`);
            }
          } catch (pErr) {
            activeCampaign.logs.push(`خطأ في النشر: ${pErr.message}`);
          }

          // 4. Safe Delay before next account
          if (i < steps.length - 1 && activeCampaign.running) {
            const waitSec = s.delay_seconds || 45;
            for (let rem = waitSec; rem > 0; rem--) {
              if (!activeCampaign.running) break;
              activeCampaign.message = `✓ تم نشر تعليق [${s.account_name}]! فاصل أمان: باقي ${rem} ثانية قبل التبديل التالي...`;
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        }

        activeCampaign.running = false;
        activeCampaign.status = 'completed';
        activeCampaign.message = '🎉 تم إكمال حملة تبادل الأدوار بنجاح لجميع الحسابات!';
        activeCampaign.logs.push(`[${new Date().toLocaleTimeString()}] انتهت الحملة بنجاح كامل.`);
      } catch (err) {
        activeCampaign.running = false;
        activeCampaign.status = 'error';
        activeCampaign.message = 'توقفت الحملة بسبب خطأ: ' + err.message;
      }
    })();
    return true;
  }

  if (request.action === 'GET_CAMPAIGN_STATUS') {
    sendResponse({ success: true, campaign: activeCampaign });
    return true;
  }

  if (request.action === 'STOP_AUTONOMOUS_CAMPAIGN') {
    activeCampaign.running = false;
    activeCampaign.status = 'stopped';
    activeCampaign.message = 'تم إيقاف الحملة يدوياً.';
    sendResponse({ success: true, campaign: activeCampaign });
    return true;
  }
});
