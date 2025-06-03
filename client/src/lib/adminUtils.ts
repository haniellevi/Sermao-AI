
export const exportDataAsJSON = (data: any, filename: string) => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportPromptAsText = (prompt: string, filename: string) => {
  const blob = new Blob([prompt], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const formatPromptForDisplay = (prompt: string) => {
  // Format the prompt for better readability
  return prompt
    .replace(/###/g, '\n###')
    .replace(/##/g, '\n##')
    .replace(/\n\n\n+/g, '\n\n')
    .trim();
};
