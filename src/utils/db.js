
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'inventory.json');

export const getItems = () => {
    if (!fs.existsSync(DB_PATH)) {
        return [];
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    try {
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
};

export const saveItems = (items) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(items, null, 2));
};
