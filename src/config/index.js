// Configuration & Environment Manager
const path = require('node:path');

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  
  // Facebook / Meta Credentials (read safely from env or fallback to center token)
  meta: {
    pageAccessToken: process.env.PAGE_ACCESS_TOKEN || 'EAAW983LxTGwBSiAMUElWiAEI98xDMsWlafjSRc7LVFCvo8Hr2up77xJCo9R5GoDf72vS1sAF7btHoTrVKGF3KFxGxKZBJmdD5omDZAQItXkKtid49qlZBdAZB7AKVIiZCdTWo1OpksV8TUZAD98gPDMmciwPf353DEMDM6sE55zOrgZA2JWOITfCqyAXdJ56n7ZBp19LZBeAQwlJW1QQoCMP0knOj',
    verifyToken: process.env.VERIFY_TOKEN || 'wada3an_pain_free_2026',
    pageId: process.env.META_PAGE_ID || '102533574608295',
    pageUsername: '30minutes30',
    pageName: 'وداعاً للألم',
    apiVersion: 'v21.0',
    graphBaseUrl: 'https://graph.facebook.com'
  },

  // Database Paths
  db: {
    path: path.join(__dirname, '..', '..', 'data', 'growth_intelligence.db')
  },

  // System & Center Info
  clinic: {
    name: 'مركز وداعاً للألم (30minutes30)',
    phone: '0790360440',
    location: 'عمّان - خلدا',
    targetFollowers: 11000
  }
};

module.exports = config;
