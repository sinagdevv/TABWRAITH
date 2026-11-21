chrome.action.onClicked.addListener(async () => {
  const arenaUrl = chrome.runtime.getURL('index.html');
  const existingTabs = await chrome.tabs.query({ url: arenaUrl });
  if (existingTabs.length > 0 && existingTabs[0].id) {
    await chrome.tabs.update(existingTabs[0].id, { active: true });
    if (existingTabs[0].windowId) {
      await chrome.windows.update(existingTabs[0].windowId, { focused: true });
    }
    return;
  }
  await chrome.tabs.create({ url: arenaUrl, active: true });
});
