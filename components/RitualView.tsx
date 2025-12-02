
import React, { useState, useEffect, useRef } from 'react';
import { generateTarotReading, generateDailyPractice, analyzeJournalEntry } from '../services/geminiService';
import { TarotReading, DailyPractice, JournalEntry, Wish } from '../types';
import { Button, Card, SectionTitle, LoadingSpinner, TabNav, SimpleMarkdown } from './Shared';
import { CreditCard, Sun, BookOpen, Shuffle, RotateCcw, Send, Sparkles, AlertCircle } from 'lucide-react';

interface RitualViewProps {
    wishes?: Wish[];
    onAddJournalEntry: (entry: JournalEntry) => void;
    onSaveRitual: (data: { date: number, reading?: TarotReading, practice?: DailyPractice }) => void;
}

// Full 78 Cards Data Generator (Chinese)
const generateTarotDeck = () => {
    const majors = [
        "愚者", "魔术师", "女祭司", "女皇", "皇帝", 
        "教皇", "恋人", "战车", "力量", "隐士", 
        "命运之轮", "正义", "倒吊人", "死神", "节制", 
        "恶魔", "高塔", "星星", "月亮", "太阳", 
        "审判", "世界"
    ];
    const suits = ["权杖", "圣杯", "宝剑", "星币"];
    const ranks = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "侍从", "骑士", "王后", "国王"];
    
    let deck: { id: number; name: string; isReversed: boolean }[] = [];
    let idCounter = 0;

    majors.forEach(m => deck.push({ id: idCounter++, name: m, isReversed: false }));
    suits.forEach(suit => {
        ranks.forEach(rank => {
            deck.push({ id: idCounter++, name: `${suit}${rank}`, isReversed: