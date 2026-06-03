const Database = require('better-sqlite3');
const db = new Database('data/pos_system.db');

const rows = db.prepare(`
  SELECT id, name_uk, name_lt, price 
  FROM menu_items 
  WHERE (
    name_uk LIKE '%комбо%' OR name_lt LIKE '%комбо%' OR 
    name_uk LIKE '%Комбо%' OR name_lt LIKE '%Комбо%' OR 
    name_uk LIKE '%-комбо%' OR name_lt LIKE '%-комбо%'
  ) OR (
    name_uk LIKE '%Coca-Cola%' OR name_lt LIKE '%Coca-Cola%' OR 
    name_uk LIKE '%Fanta%' OR name_lt LIKE '%Fanta%' OR 
    name_uk LIKE '%Sprite%' OR name_lt LIKE '%Sprite%'
  ) 
  ORDER BY name_uk
`).all();

console.log('Найденные блюда:');
rows.forEach(r => console.log(`id=${r.id} | uk=${r.name_uk} | lt=${r.name_lt} | price=${r.price}`));

db.close();
