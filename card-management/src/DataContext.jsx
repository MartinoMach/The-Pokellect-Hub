import React, { createContext, useState, useEffect, useContext } from 'react';
import { getGlobalCards, getMyBinder } from './api.js';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const [globalCards, setGlobalCards] = useState([]);
  const [binderCards, setBinderCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const username = localStorage.getItem('username');
      if (username) {
        const binderData = await getMyBinder(username);
        setBinderCards(binderData.binder || binderData.items || binderData || []);
      }
      const cardsData = await getGlobalCards();
      setGlobalCards(cardsData.cards || cardsData || []);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshBinder = async () => {
    const username = localStorage.getItem('username');
    if (username) {
      const binderData = await getMyBinder(username);
      setBinderCards(binderData.binder || binderData.items || binderData || []);
    }
  };

  return (
    <DataContext.Provider value={{ globalCards, binderCards, isLoading, refreshBinder, loadData }}>
      {children}
    </DataContext.Provider>
  );
};
