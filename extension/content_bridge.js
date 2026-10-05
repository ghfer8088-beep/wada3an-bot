/**
 * Bridge script between Local Dashboard (localhost:3000) and Chrome Extension
 */
(function() {
  // Query background for active FB account and pass to dashboard
  function syncAccount() {
    chrome.runtime.sendMessage({ action: 'GET_FB_ACCOUNT' }, (response) => {
      if (chrome.runtime.lastError || !response) return;
      window.postMessage({
        type: 'GROWTH_ENGINE_ACCOUNT_SYNC',
        account: response
      }, '*');
    });
  }

  // Listen to requests from dashboard webpage
  window.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.type === 'GROWTH_ENGINE_REQUEST_SYNC') {
      syncAccount();
    }

    if (event.data.type === 'GROWTH_ENGINE_POST_COMMENT') {
      chrome.runtime.sendMessage({
        action: 'POST_COMMENT_TO_FACEBOOK',
        url: event.data.url,
        text: event.data.text
      }, (res) => {
        window.postMessage({
          type: 'GROWTH_ENGINE_COMMENT_RESULT',
          result: res || { success: false, message: 'لا توجد استجابة من الإضافة' }
        }, '*');
      });
    }

    if (event.data.type === 'GROWTH_ENGINE_SCAN_ACTIVE_TAB') {
      chrome.runtime.sendMessage({ action: 'SCAN_ACTIVE_TAB_POSTS' }, (res) => {
        window.postMessage({
          type: 'GROWTH_ENGINE_SCAN_RESULT',
          result: res || { success: false, message: 'تعذر الاتصال بلسان فيسبوك' }
        }, '*');
      });
    }

    if (event.data.type === 'GROWTH_ENGINE_START_AUTO_SCAN') {
      chrome.runtime.sendMessage({
        action: 'START_AUTONOMOUS_RADAR_SCAN',
        target: event.data.target,
        query: event.data.query,
        sort: event.data.sort
      }, (res) => {
        window.postMessage({
          type: 'GROWTH_ENGINE_AUTO_SCAN_RESULT',
          result: res || { success: false, message: 'تعذر تشغيل المسح الآلي' }
        }, '*');
      });
    }

    if (event.data.type === 'GROWTH_ENGINE_CAPTURE_SESSION') {
      chrome.runtime.sendMessage({
        action: 'CAPTURE_CURRENT_SESSION',
        label: event.data.label,
        role: event.data.role
      }, (res) => {
        window.postMessage({
          type: 'GROWTH_ENGINE_CAPTURE_SESSION_RESULT',
          result: res || { success: false }
        }, '*');
      });
    }

    if (event.data.type === 'GROWTH_ENGINE_SWITCH_ACCOUNT') {
      chrome.runtime.sendMessage({
        action: 'SWITCH_FB_ACCOUNT',
        uid: event.data.uid
      }, (res) => {
        window.postMessage({
          type: 'GROWTH_ENGINE_SWITCH_ACCOUNT_RESULT',
          result: res || { success: false }
        }, '*');
      });
    }

    if (event.data.type === 'GROWTH_ENGINE_GET_SAVED_ACCOUNTS') {
      chrome.runtime.sendMessage({ action: 'GET_ALL_SAVED_ACCOUNTS' }, (res) => {
        window.postMessage({
          type: 'GROWTH_ENGINE_GET_SAVED_ACCOUNTS_RESULT',
          result: res || { success: false, accounts: [] }
        }, '*');
      });
    }

    if (event.data.type === 'GROWTH_ENGINE_START_AUTONOMOUS_CAMPAIGN') {
      chrome.runtime.sendMessage({
        action: 'START_AUTONOMOUS_CAMPAIGN',
        postUrl: event.data.postUrl,
        steps: event.data.steps
      }, (res) => {
        window.postMessage({
          type: 'GROWTH_ENGINE_CAMPAIGN_STARTED_RESULT',
          result: res || { success: false }
        }, '*');
      });
    }

    if (event.data.type === 'GROWTH_ENGINE_GET_CAMPAIGN_STATUS') {
      chrome.runtime.sendMessage({ action: 'GET_CAMPAIGN_STATUS' }, (res) => {
        window.postMessage({
          type: 'GROWTH_ENGINE_CAMPAIGN_STATUS_RESULT',
          result: res || { success: false }
        }, '*');
      });
    }

    if (event.data.type === 'GROWTH_ENGINE_STOP_CAMPAIGN') {
      chrome.runtime.sendMessage({ action: 'STOP_AUTONOMOUS_CAMPAIGN' }, (res) => {
        window.postMessage({
          type: 'GROWTH_ENGINE_CAMPAIGN_STOPPED_RESULT',
          result: res || { success: false }
        }, '*');
      });
    }
  });

  // Initial sync
  syncAccount();
})();
