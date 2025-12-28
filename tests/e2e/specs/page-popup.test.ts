describe('Webextension Popup', () => {
  it('should open the popup successfully', async () => {
    const extensionPath = await browser.getExtensionPath();
    const popupUrl = `${extensionPath}/popup/index.html`;
    await browser.url(popupUrl);

    await expect(browser).toHaveTitle('Popup');

    // Check that the main elements exist
    const header = await $('header').getElement();
    await expect(header).toBeExisting();

    const input = await $('input[type="text"]').getElement();
    await expect(input).toBeExisting();

    const addCurrentPageButton = await $('button').getElement();
    await expect(addCurrentPageButton).toBeExisting();
  });
});
