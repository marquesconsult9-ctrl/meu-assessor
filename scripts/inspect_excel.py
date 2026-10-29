import openpyxl

wb = openpyxl.load_workbook('Controle_Financeiro_Mensal_V4.xlsx', data_only=True)

with open('excel_dump.txt', 'w', encoding='utf-8') as out:
    for sname in wb.sheetnames:
        ws = wb[sname]
        out.write(f"\n================ SHEET: {sname} (rows={ws.max_row}, cols={ws.max_column}) ================\n")
        for r in range(1, ws.max_row + 1):
            row_vals = [ws.cell(r, c).value for c in range(1, ws.max_column + 1)]
            while row_vals and row_vals[-1] is None:
                row_vals.pop()
            if row_vals:
                out.write(f"R{r:03d}: {row_vals}\n")

print("Dumped to excel_dump.txt successfully")
