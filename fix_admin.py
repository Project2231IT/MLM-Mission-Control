import re
with open('/opt/mlm-mission-control/src/app/admin/AdminClient.tsx', 'r') as f:
    content = f.read()
# Remove handleUnlock function
pattern = r'\n  const handleUnlock = async \(id: string\) \{.*?\}\n'
content = re.sub(pattern, '\n', content, flags=re.DOTALL)
with open('/opt/mlm-mission-control/src/app/admin/AdminClient.tsx', 'w') as f:
    f.write(content)
print("Fixed")
