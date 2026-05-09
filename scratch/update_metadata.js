import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yihizwspxnxlfowvitoe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGl6d3NweG54bGZvd3ZpdG9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjkwNDU5MywiZXhwIjoyMDg4NDgwNTkzfQ.DFeL-VwIMCuY92_yev5xp3kVwS5g7SUsLfRfNWeH0gs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateUsers() {
  const usersToUpdate = [
    '5375df34-66b8-4d8e-bed3-762b1c5dd38d', // sellosquesello@gmail.com
    '73b28d9f-c64f-4880-b8a2-d098be60de70'  // matias8adg@gmail.com
  ];

  for (const uid of usersToUpdate) {
    const { data, error } = await supabase.auth.admin.updateUserById(
      uid,
      { user_metadata: { franquicia_id: 1, nombre: "Casa Matriz" } }
    );
    if (error) {
      console.error(`Error actualizando ${uid}:`, error.message);
    } else {
      console.log(`Usuario ${data.user.email} actualizado con éxito.`);
    }
  }
}

updateUsers();
