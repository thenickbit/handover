'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Database } from '@/types/supabase';

export function UploadScreenDialog() {
  const [svgFile, setSvgFile] = useState<{ name: string; content: string }>();
  const [dialogOpen, setDialogOpen] = useState<boolean>(false)
  const supabase = createClientComponentClient<Database>();
  const router = useRouter();

  const formSchema = z.object({
    name: z.string().min(2, {
      message: 'Name must be at least 2 characters.',
    }),
    file: z.string().min(2, { message: 'A file is necessary.' }),
  });

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/svg+xml': ['.svg'],
    },
    maxFiles: 1,
    maxSize: 1024 * 1024 * 10,
    onDrop: (acceptedFiles) => handleFileChange(acceptedFiles[0]),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      file: '',
    },
  });

  const readSvgFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') {
          resolve(event.target.result);
        } else {
          reject(new Error('File content could not be read'));
        }
      };

      reader.onerror = (error) => {
        reject(error);
      };

      reader.readAsText(file);
    });
  };

  const handleFileChange = async (file: File) => {
    if (file) {
      try {
        const svgContent = await readSvgFile(file);
        setSvgFile({ name: file.name, content: svgContent });
        console.log(file);
        form.setValue('file', svgContent);
      } catch (error) {
        console.error('Error reading SVG file', error);
      }
    }
  };

  // async function onSubmit(values: z.infer<typeof formSchema>) {
  //   const { data, error, status } = await supabase
  //     .from('screens')
  //     .insert({ name: values.name, html_file: values.file });

  //   router.refresh();
  //   setDialogOpen(false)
  //   console.log({ data, error, status });
  // }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const { data: existingScreen } = await supabase
        .from('screens')
        .select('id')
        .eq('name', values.name)
        .maybeSingle();

      if (existingScreen) {
        await updateExistingScreen(values, existingScreen.id);
      } else {
        await createNewScreen(values);
      }

      router.refresh();
      setDialogOpen(false);
    } catch (error) {
      console.error(error);
    }
  }

  async function updateExistingScreen(values: z.infer<typeof formSchema>, screenId: number) {
    const versionResponse = await createNewVersion(screenId, values);

    if (!versionResponse || versionResponse.error) {
      throw versionResponse ? versionResponse.error : new Error('Version response is undefined');
    }

    const updateResponse = await supabase
      .from('screens')
      .update({ html_file: values.file })
      .eq('id', screenId);

    if (!updateResponse || updateResponse.error) {
      throw updateResponse ? updateResponse.error : new Error('Update response is undefined');
    }

    console.log({ data: updateResponse.data });
  }


  async function createNewVersion(screenId: number, values: z.infer<typeof formSchema>) {
    const { data: lastVersion } = await supabase
    .from('screens')
    .select('version')
    .order('version', { ascending: false })
    .limit(1);

    const newVersion = (lastVersion && lastVersion[0]?.version + 1) || 1;


    const response = await supabase
      .from('screens')
      .insert({
        name: values.name,
        html_file: values.file,
        version: newVersion,
        changes: "TODO: Specify the changes here"
      });
  
    if (response.error) {
      throw response.error;
    }
  
    console.log({ newVersion: response.data });
  
    return response; // Add this line
  }
  

  async function createNewScreen(values: z.infer<typeof formSchema>) {
    const { data, error, status } = await supabase
      .from('screens')
      .insert({ name: values.name, html_file: values.file, changes: "", version: 1 });

    if (error) {
      throw error;
    }

    console.log({ data, status });
  }





  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="default">Upload new screen</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[465px]">
        <DialogHeader>
          <DialogTitle>Upload new screen</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My new screen" {...field} />
                  </FormControl>
                  <FormDescription>This is the name of the screen.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="file"
              render={() => (
                <FormItem>
                  <FormLabel>SVG File</FormLabel>
                  <FormControl>
                    {svgFile ? (
                      <div>
                        <Badge className="select-none">{svgFile.name}</Badge>
                      </div>
                    ) : (
                      <div
                        {...getRootProps({
                          className:
                            'bg-background/90 border rounded-md border-dashed dark:border-gray-700 border-gray-300 h-20 flex items-center justify-center',
                        })}
                      >
                        <Input {...getInputProps()} />
                        <FormDescription>Click to open or drop your file here.</FormDescription>
                      </div>
                    )}
                  </FormControl>
                  <FormDescription>This is the file exported from Figma.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Submit</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
