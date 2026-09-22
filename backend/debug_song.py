import sys
sys.path.insert(0, '.')
from services.library import get_library, find_song

songs = get_library()

# Look for Culture Club songs
matches = [s for s in songs if 'Culture Club' in s.get('filename','') and 'Karma' in s.get('filename','')][:10]
for m in matches:
    print('ID:', repr(m['id']))
    print('  path:', m['path'])
    print('  exists:', __import__('pathlib').Path(m['path']).exists())
    print()

# Test find_song on first match
if matches:
    print('Testing find_song on:', repr(matches[0]['id']))
    result = find_song(matches[0]['id'])
    print('Found:', result is not None)