// Acceso a una tabla del hogar: Supabase con sesión iniciada, localStorage en modo local.
// Lo usan los módulos que se cargan después de app.js (compra y tareas), que leen
// supabaseClient, authUserId y householdId de app.js.
function createHouseholdStore({ table, localKey }) {
  const readLocal = () => {
    try { return JSON.parse(localStorage.getItem(localKey) || '[]'); } catch { return []; }
  };
  const writeLocal = (rows) => localStorage.setItem(localKey, JSON.stringify(rows));
  const inCloud = () => {
    if (!supabaseClient || !authUserId) return false;
    if (!householdId) throw new Error('Tu hogar aún se está conectando. Vuelve a intentarlo en un momento.');
    return true;
  };

  return {
    // build personaliza la consulta de Supabase; filter hace lo mismo en local.
    async list({ build = (query) => query, filter = () => true } = {}) {
      if (inCloud()) {
        const { data, error } = await build(supabaseClient.from(table).select('*').eq('household_id', householdId));
        if (error) throw error;
        return data;
      }
      return readLocal().filter(filter);
    },
    async insert(values) {
      const rows = [].concat(values);
      if (inCloud()) {
        const { data, error } = await supabaseClient.from(table).insert(rows.map((row) => ({ ...row, household_id: householdId }))).select('*');
        if (error) throw error;
        return data;
      }
      const created = rows.map((row) => ({ id: createLocalId(), created_at: new Date().toISOString(), ...row }));
      writeLocal([...created, ...readLocal()]);
      return created;
    },
    async update(ids, changes) {
      const list = [].concat(ids);
      if (inCloud()) {
        const { error } = await supabaseClient.from(table).update(changes).in('id', list);
        if (error) throw error;
        return;
      }
      writeLocal(readLocal().map((row) => (list.includes(row.id) ? { ...row, ...changes } : row)));
    },
    async remove(ids) {
      const list = [].concat(ids);
      if (inCloud()) {
        const { error } = await supabaseClient.from(table).delete().in('id', list);
        if (error) throw error;
        return;
      }
      writeLocal(readLocal().filter((row) => !list.includes(row.id)));
    },
    // Avisa cuando la otra persona cambia algo (solo con Supabase).
    subscribe(onChange) {
      if (!supabaseClient || !authUserId || !householdId) return;
      supabaseClient.channel(`${table}-live`).on('postgres_changes', { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` }, onChange).subscribe();
    }
  };
}

// Personas del hogar. Las tablas de finanzas ya usan estos dos nombres.
const householdPeople = ['Ines', 'Matteo'];
const otherPerson = (name) => householdPeople.find((person) => person !== name) || name;
const initialsOf = (name) => String(name || '?').slice(0, 2).toUpperCase();
const normalizeText = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const capitalizeFirst = (value) => value.charAt(0).toUpperCase() + value.slice(1);
