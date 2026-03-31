import { CaretSortIcon } from "@radix-ui/react-icons";
import { CheckIcon, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty, CommandItem,
  CommandList
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  type GetClients200,
  getClientById,
  useGetClients,
} from "@/http/generated";
import { cn } from "@/lib/utils";
import { inputCpfMask } from "@/utils/inputMasks";
import { Input } from "../ui/input";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";

// import { ClientForm } from '@/app/(app)/clients/client-form';

type ClientInputProps = {
  clientId?: string;
  setClientId: (clientId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  createClient?: boolean;
};

type Client = GetClients200["data"][0];

export function ClientInput({
  clientId,
  setClientId,
  disabled,
  placeholder,
  // createClient = true,
}: ClientInputProps) {
  const [open, setOpen] = useState(false);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);

  const [name, setName] = useState("");

  const { data, isLoading } = useGetClients({
    "p.pageSize": 10,
    "f.filter": name,
  });

  const clients = useMemo(() => data?.data || [], [data]);

  const [selectClient, setSelectedClient] = useState<Client | null>(null); // eslint-disable-line

  useEffect(() => {
    async function getClient() {
      if (clientId) {
        const client = clients.find((c) => c.id === clientId);
        if (!client) {
          const fetchClient = await getClientById(clientId);

          if (fetchClient.data.client) {
            setSelectedClient(fetchClient.data.client);
          }
        }
      }
    }

    getClient();
  }, [clientId, clients]);

  const selectedClient = useMemo(() => {
    return clients.find((client) => client.id === clientId) || selectClient;
  }, [clients, clientId, selectClient]);

  function setClient(cId: string) {
    setClientId(cId);
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setShowNewClientDialog} open={showNewClientDialog}>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            aria-label="Select a client"
            className={cn("flex w-full justify-between capitalize")}
            disabled={disabled}
            variant="outline"
          >
            {/* {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} */}
            {selectedClient
              ? `${selectedClient.name}${selectedClient.document !== null ? ` - ${inputCpfMask(selectedClient.document ?? "")}` : ""}`
              : placeholder || "Selecione um paciente"}
            <CaretSortIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[400px] overflow-hidden p-0">
          <ScrollArea>
            <Command>
              <CommandList className="max-h-max overflow-y-hidden">
                <div className="flex h-13 items-center border-b px-3">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 " />
                  <Input
                    className="flex h-11 w-full rounded-md border-0 border-transparent border-none bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground hover:border-transparent hover:border-none focus-visible:border-none focus-visible:ring-0 focus-visible:ring-transparent disabled:cursor-not-allowed disabled:opacity-50 dark:border-transparent dark:bg-transparent"
                    onChange={(e) => {
                      setName(e.target.value);
                    }}
                    placeholder="Buscar paciente..."
                    value={name}
                  />
                </div>
                <CommandEmpty>Nem um paciente encontrado.</CommandEmpty>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedClient &&
                  !clients.find((c) => c.id === selectedClient.id) && (
                    <CommandItem className="text-sm" key={selectedClient.id}>
                      {selectedClient.name}
                      {selectedClient.document !== null
                        ? ` - ${inputCpfMask(selectedClient.document ?? "")}`
                        : ""}
                      <CheckIcon
                        className={cn("ml-auto h-4 w-4", "opacity-100")}
                      />
                    </CommandItem>
                  )}
                {clients.map((client) => (
                  <CommandItem
                    className="text-sm"
                    key={client.id}
                    onSelect={() => {
                      setClient(client.id);
                    }}
                  >
                    {client.name}
                    {client.document !== null
                      ? ` - ${inputCpfMask(client.document ?? "")}`
                      : ""}
                    <CheckIcon
                      className={cn(
                        "ml-auto h-4 w-4",
                        selectedClient?.id === client.id
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandList>
              {/* <CommandSeparator />
              <CommandList>
                <CommandGroup>
                  <DialogTrigger asChild>
                    <CommandItem
                      disabled={!createClient}
                      onSelect={() => {
                        setOpen(false);
                        setShowNewClientDialog(true);
                      }}
                    >
                      <PlusCircledIcon className="mr-2 h-5 w-5" />
                      Cadastrar Cliente
                    </CommandItem>
                  </DialogTrigger>
                </CommandGroup>
              </CommandList> */}
            </Command>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </PopoverContent>
      </Popover>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar Cliente</DialogTitle>
        </DialogHeader>
        {/* <ClientForm
          // isOpen={showNewClientDialog}
          refetch={(client) =>
            (async () => {
              // refetch();
              client && setClientId(client.id);
            })()
          }
          setIsOpen={setShowNewClientDialog}
        /> */}
      </DialogContent>
    </Dialog>
  );
}
