/**
 * GrowthEngine Meta Suite Pro - Popup Controller
 * Full Multi-Account Session Management & Auto-Pilot Status
 */

document.addEventListener('DOMContentLoaded', () => {
  const nameEl = document.getElementById('name');
  const uidEl = document.getElementById('uid');
  const avatarEl = document.getElementById('avatar');
  const statusPillEl = document.getElementById('status-pill');
  const captureBtn = document.getElementById('capture-btn');
  const savedListEl = document.getElementById('saved-list');
  const savedCountEl = document.getElementById('saved-count');
  const accCountBadge = document.getElementById('acc-count-badge');
  const campaignBox = document.getElementById('campaign-box');
  const campaignMsg = document.getElementById('campaign-msg');

  let currentUid = null;

  function refreshAccount() {
    chrome.runtime.sendMessage({ action: 'GET_FB_ACCOUNT' }, res => {
      if (!res || !res.connected) {
        if (nameEl) nameEl.textContent = 'غير متصل بفيسبوك';
        if (uidEl) uidEl.textContent = 'يرجى تسجيل الدخول في فيسبوك أولاً';
        if (statusPillEl) {
          statusPillEl.innerHTML = '<span class="dot" style="background:#ef4444;"></span> غير مسجل';
          statusPillEl.style.color = '#ef4444';
        }
        return;
      }

      currentUid = res.uid;
      if (nameEl) nameEl.textContent = res.name || 'مستخدم فيسبوك';
      if (uidEl) uidEl.textContent = 'UID: ' + res.uid;
      if (avatarEl) {
        avatarEl.src = res.avatar || `https://graph.facebook.com/${res.uid}/picture?type=large`;
      }
      if (statusPillEl) {
        statusPillEl.innerHTML = '<span class="dot" style="background:#10b981;"></span> متصل وجاهز للتبديل';
        statusPillEl.style.color = '#10b981';
      }
    });
  }

  async function loadSavedAccounts() {
    let list = [];

    // 1. Fetch live from central server vault (localhost:3000)
    try {
      const sRes = await fetch('http://localhost:3000/api/growth-engine/get-all-sessions');
      const sData = await sRes.json();
      if (sData.success && sData.sessions && sData.sessions.length > 0) {
        list = sData.sessions;
        await chrome.storage.local.set({ savedAccountsList: list });
      }
    } catch (_) {}

    // 2. Fallback to local storage if server unreachable
    if (list.length === 0) {
      try {
        const stored = await chrome.storage.local.get(['savedAccountsList']);
        list = stored.savedAccountsList || [];
      } catch (_) {}
    }

    renderSavedListUI(list);
  }

  function renderSavedListUI(list) {
    if (savedCountEl) savedCountEl.textContent = list.length;
    if (accCountBadge) accCountBadge.textContent = list.length + ' حسابات';

    if (!savedListEl) return;
    if (list.length === 0) {
      savedListEl.innerHTML = '<div style="color:#64748b; font-size:10px; text-align:center; padding:10px;">لم يتم حفظ أي حساب بعد. اضغط زر الحفظ أعلاه لحفظ الحساب المفتوح.</div>';
      return;
    }

    savedListEl.innerHTML = '';
    list.forEach((acc, idx) => {
      const item = document.createElement('div');
      item.className = 'acc-item';
      const isCurrent = acc.uid === currentUid;
      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="color:#10b981; font-weight:800;">${idx + 1}.</span>
          <span style="font-weight:700; color:${isCurrent ? '#10b981' : '#fff'};">${acc.name}</span>
          ${isCurrent ? '<span style="font-size:9px; background:#10b981; color:#000; padding:1px 4px; border-radius:3px;">نشط</span>' : ''}
        </div>
        <div style="display:flex; gap:4px;">
          <button class="switch-btn" data-uid="${acc.uid}">تبديل</button>
          <button style="background:#ef4444; color:#fff; border:none; padding:2px 6px; border-radius:4px; font-size:10px; cursor:pointer;" data-del="${acc.uid}">×</button>
        </div>
      `;
      savedListEl.appendChild(item);
    });

    // Bind Switch & Delete buttons
    savedListEl.querySelectorAll('.switch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetUid = btn.getAttribute('data-uid');
        btn.textContent = 'جارٍ...';
        chrome.runtime.sendMessage({ action: 'SWITCH_FB_ACCOUNT', uid: targetUid }, r => {
          if (r && r.success) {
            refreshAccount();
            loadSavedAccounts();
            chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
              if (tabs && tabs[0]) chrome.tabs.reload(tabs[0].id);
            });
          } else {
            alert(r?.message || 'تعذر التبديل');
            btn.textContent = 'تبديل';
          }
        });
      });
    });

    savedListEl.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const uidToDel = btn.getAttribute('data-del');
        chrome.runtime.sendMessage({ action: 'DELETE_SAVED_ACCOUNT', uid: uidToDel }, () => {
          loadSavedAccounts();
        });
      });
    });
  }

  if (captureBtn) {
    captureBtn.addEventListener('click', () => {
      captureBtn.textContent = '⏳ جارٍ التقاط الجلسة...';
      captureBtn.disabled = true;

      chrome.runtime.sendMessage({ action: 'CAPTURE_CURRENT_SESSION' }, res => {
        captureBtn.disabled = false;
        captureBtn.textContent = '💾 حفظ جلسة هذا الحساب في قائمة التبديل';
        if (res && res.success) {
          alert('✓ تم حفظ جلسة الحساب بنجاح في الإضافة: ' + res.account.name);
          refreshAccount();
          loadSavedAccounts();
        } else {
          alert(res?.message || 'تعذر حفظ الجلسة. تأكد من فتح فيسبوك أولاً.');
        }
      });
    });
  }

  // Check campaign status polling
  function pollCampaign() {
    chrome.runtime.sendMessage({ action: 'GET_CAMPAIGN_STATUS' }, res => {
      if (res && res.campaign && res.campaign.running) {
        if (campaignBox) campaignBox.style.display = 'block';
        if (campaignMsg) campaignMsg.textContent = res.campaign.message;
      } else {
        if (campaignBox) campaignBox.style.display = 'none';
      }
    });
  }

  refreshAccount();
  loadSavedAccounts();
  pollCampaign();
  setInterval(pollCampaign, 2000);
});
