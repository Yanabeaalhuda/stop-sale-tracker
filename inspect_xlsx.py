import os
import zipfile
import xml.etree.ElementTree as ET

def search_xlsx_text(filepath, search_term):
    try:
        with zipfile.ZipFile(filepath, 'r') as zip_ref:
            if 'xl/sharedStrings.xml' in zip_ref.namelist():
                xml_content = zip_ref.read('xl/sharedStrings.xml')
                root = ET.fromstring(xml_content)
                
                # Namespaces
                ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                
                # Find all text elements
                texts = []
                for t in root.findall('.//main:t', ns):
                    if t.text and search_term.lower() in t.text.lower():
                        texts.append(t.text)
                return texts
            else:
                return []
    except Exception as e:
        return [f"Error: {str(e)}"]

data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
for file in os.listdir(data_dir):
    if file.lower().endswith(('.xlsx', '.xls')):
        filepath = os.path.join(data_dir, file)
        matches = search_xlsx_text(filepath, "Tilal")
        print(f"File: {file}")
        print(f"Matches for 'Tilal': {matches[:10]}")
        print("-" * 40)
