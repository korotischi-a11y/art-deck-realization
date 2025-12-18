/**
 * Кнопки действия с картой
 */
function renderCardActionButtons(cardId, container) {
  if (decks.activeDeckId) {
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn';
    removeBtn.style.cssText = 'width:100%; background:#666; color:white; border:none; cursor:pointer; font-weight:600; padding:10px; border-radius:6px;';
    removeBtn.textContent = '🗑 Удалить из колоды';
    removeBtn.onclick = async () => {
      const success = await decks.removeCardFromActiveDeck(cardId);
      if (success) {
        ui.showToast('✅ Удалено из колоды', 'success');
        closeModal('card-detail-modal');
        decks.renderDecks();
        renderCollection();
      } else {
        ui.showError('Ошибка');
      }
    };
    container.appendChild(removeBtn);
  }
  
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn';
  deleteBtn.style.cssText = 'width:100%; background:#ef4444; color:white; border:none; cursor:pointer; font-weight:600; padding:10px; border-radius:6px;';
  deleteBtn.textContent = '⚠️ ПОРВАТЬ НАВСЕГДА';
  deleteBtn.onclick = async () => {
    const u = state.currentUser;
    const decksObj = u.decks || {};
    let totalCount = 0;
    for (const deck of Object.values(decksObj)) {
      if (deck.cards && deck.cards[cardId]) {
        totalCount += deck.cards[cardId];
      }
    }
    
    if (totalCount === 0) {
      ui.showError('Карта не найдена в коллекции');
      return;
    }
    
    const countToDelete = prompt(
      `Выберите кол-во копий для удаления\n\nВсего копий: ${totalCount}\n\nВведите количество (или 0 для удаления ВСЕХ):`,
      '1'
    );
    
    if (countToDelete === null) return;
    
    let deleteCount = parseInt(countToDelete, 10);
    
    if (deleteCount === 0) deleteCount = totalCount;
    
    if (isNaN(deleteCount) || deleteCount <= 0 || deleteCount > totalCount) {
      ui.showError(`❌ Ошибка: введите число от 1 до ${totalCount}`);
      return;
    }
    
    const confirm1 = confirm(
      `⚠️ Порвать ${deleteCount}/${totalCount} копий этой карты?\n\nЭто удалит карту из ВСЕХ колод!`
    );
    if (!confirm1) return;
    
    if (deleteCount < totalCount) {
      const confirm2 = confirm(
        `⏰ Подтвердите: удалить ровно ${deleteCount} копий (останется ${totalCount - deleteCount})?`
      );
      if (!confirm2) return;
    } else {
      const confirm2 = confirm(
        `⚠️ ПОСЛЕДНЕЕ ПОПИНАНИЕ: удалить ВСЕ ${totalCount} копий карты НАВСЕГДА?`
      );
      if (!confirm2) return;
    }
    
    const success = await deleteCardPartially(cardId, deleteCount);
    if (success) {
      ui.showToast(`✅ Удалено ${deleteCount} копий`, 'success');
      closeModal('card-detail-modal');
      await decks.loadDecks();
      decks.renderDecks();
      renderCollection();
    } else {
      ui.showError('Ошибка при удалении');
    }
  };
  container.appendChild(deleteBtn);
}

async function deleteCardPartially(cardId, countToDelete) {
  try {
    const u = state.currentUser;
    if (!u) return false;
    
    const db = firebase.firestore();
    const decksObj = u.decks || {};
    let remainingToDelete = countToDelete;
    
    for (const [deckId, deck] of Object.entries(decksObj)) {
      if (!deck.cards || !deck.cards[cardId]) continue;
      
      const countInDeck = deck.cards[cardId];
      const toRemove = Math.min(countInDeck, remainingToDelete);
      
      deck.cards[cardId] -= toRemove;
      remainingToDelete -= toRemove;
      
      if (deck.cards[cardId] <= 0) {
        delete deck.cards[cardId];
      }
      
      await db.collection('users').doc(u.uid)
        .collection('decks').doc(deckId)
        .update({ cards: deck.cards });
      
      if (remainingToDelete === 0) break;
    }
    
    await decks.loadDecks();
    return true;
  } catch (e) {
    console.error('Error deleting card partially:', e);
    return false;
  }
}