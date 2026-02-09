export default () => ({
  type: 'content-api',
  routes: [
    {
      method: 'POST',
      path: '/webhook',
      handler: 'webhook.handle',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
});
