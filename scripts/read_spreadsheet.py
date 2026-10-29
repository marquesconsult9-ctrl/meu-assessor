import openpyxl
import json
import os
from datetime import datetime, date

wb = openpyxl.load_workbook('Controle_Financeiro_Mensal_V4.xlsx', data_only=True)

def serialize_val(v):
    if isinstance(v, (datetime, date)):
        return v.strftime('%Y-%m-%d %H:%M:%S')
    return v

# 1. Despesas Fixas e Recorrentes
ws_desp = wb[wb.sheetnames[0]]
headers_desp = [ws_desp.cell(2, c).value for c in range(1, ws_desp.max_column + 1)]
while headers_desp and headers_desp[-1] is None:
    headers_desp.pop()

despesas = []
for r in range(3, ws_desp.max_row + 1):
    vals = [ws_desp.cell(r, c).value for c in range(1, len(headers_desp) + 1)]
    if any(v is not None for v in vals):
        if vals[0] is None and vals[1] is not None and 'TOTAL' in str(vals[1]):
            continue
        row_dict = {}
        for h, v in zip(headers_desp, vals):
            h_clean = str(h).replace('\n', ' ').strip()
            row_dict[h_clean] = serialize_val(v)
        despesas.append(row_dict)

# 2. Cartao
ws_cart = wb[wb.sheetnames[1]]
headers_cart = [ws_cart.cell(1, c).value for c in range(1, ws_cart.max_column + 1)]
while headers_cart and headers_cart[-1] is None:
    headers_cart.pop()

cartao = []
for r in range(2, ws_cart.max_row + 1):
    vals = [ws_cart.cell(r, c).value for c in range(1, len(headers_cart) + 1)]
    if any(v is not None for v in vals):
        row_dict = {}
        for h, v in zip(headers_cart, vals):
            h_clean = str(h).replace('\n', ' ').strip()
            row_dict[h_clean] = serialize_val(v) if v is not None else ''
        cartao.append(row_dict)

payload = {
    'despesas': despesas,
    'cartao': cartao
}

os.makedirs('data', exist_ok=True)
with open('data/spreadsheet_data.json', 'w', encoding='utf-8') as f:
    json.dump(payload, f, indent=2, ensure_ascii=False)

print(f"Sucesso: {len(despesas)} despesas fixas e {len(cartao)} parcelamentos extraídos para data/spreadsheet_data.json")
