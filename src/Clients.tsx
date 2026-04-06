import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

interface Cliente {
  id: string;
  nombre: string;
  empresa: string;
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);

  async function fetchClientes() {
    const { data } = (await supabase.from('clientes').select('*')) as {
      data: Cliente[];
    };
    setClientes(data);
  }

  useEffect(() => {
    void (async function () {
      await fetchClientes();
    })();
  }, []);

  return (
    <ul>
      {clientes.map((cliente: Cliente) => (
        <li key={cliente.id}>
          {cliente.nombre} - {cliente.empresa}
        </li>
      ))}
    </ul>
  );
}
