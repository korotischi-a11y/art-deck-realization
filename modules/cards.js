  addBtn.onclick = async () => {
    const deckId = select.value;
    if (!deckId) {
      ui.showError('Выберите колоду');
      return;
    }
    
    ПРОВЕРЯЕМ: есть ли карта в сбросе?
    const discardDeckId = await decks.getOrCreateDiscardDeck();
    
    // ПЕРЕНОСИМ КАРТУ ДНА
    const success = await decks.moveCardBetweenDecks(cardId, discardDeckId, deckId, 1);
    
    if (success) {
      ui.showToast(`✅ Перенесено в ${select.options[select.selectedIndex].text}!`, 'success');
      closeModal('card-detail-modal');
      await decks.loadDecks();
      decks.renderDecks();
      renderCollection();
    } else {
      ui.showError('Ошибка: нет карты в сбросе или колода не найдена');
    }
  };